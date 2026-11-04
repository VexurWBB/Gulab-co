import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import sharp from 'sharp'

const root = path.resolve('public')
const destination = path.join(root, 'assets/images/optimised')
await fs.mkdir(destination, { recursive: true })
const manifest = {}
const generated = new Set()
let originalBytes = 0
let fallbackBytes = 0
async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (file === destination) continue
    if (entry.isDirectory()) { await walk(file); continue }
    if (!/\.(jpe?g|png|webp)$/i.test(entry.name)) continue
    const source = await fs.readFile(file)
    const metadata = await sharp(source).rotate().metadata()
    const width = metadata.autoOrient?.width ?? metadata.width
    const height = metadata.autoOrient?.height ?? metadata.height
    const widths = [...new Set([240, 640, 1280, 1920].map(size => Math.min(size, width)))].sort((a, b) => a - b)
    const variants = []
    for (const size of widths) {
      const output = await sharp(source).rotate().resize({ width: size, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer()
      const hash = createHash('sha256').update(output).digest('hex').slice(0, 12)
      const name = `${path.parse(file).name}-${size}-${hash}.webp`
      await fs.writeFile(path.join(destination, name), output)
      generated.add(name)
      variants.push({ src: `/assets/images/optimised/${name}`, width: size, bytes: output.length })
    }
    const fallback = variants.find(item => item.width >= Math.min(width, 1280)) ?? variants.at(-1)
    manifest['/' + path.relative(root, file).replaceAll('\\', '/')] = { src: fallback.src, width, height, srcSet: variants.map(item => `${item.src} ${item.width}w`).join(', ') }
    originalBytes += source.length
    fallbackBytes += fallback.bytes
  }
}
await walk(path.join(root, 'assets/images'))
for (const file of await fs.readdir(destination)) {
  if (!generated.has(file) && /^[\w-]+\.webp$/.test(file)) await fs.unlink(path.join(destination, file))
}
await fs.writeFile('scripts/optimisedImages.json', JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify({ images: Object.keys(manifest).length, originalBytes, fallbackBytes }))
