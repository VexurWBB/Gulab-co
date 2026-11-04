import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'

const url = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300..600&family=Playfair+Display:ital,wght@0,400..600;1,400..600&display=swap'
const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' } })
if (!response.ok) throw new Error(`Font stylesheet ${response.status}`)
const css = await response.text()
const faces = [...css.matchAll(/\/\* latin \*\/\s*(@font-face\s*\{[^}]+\})/g)].map(match => match[1])
if (faces.length !== 3) throw new Error(`Expected three font faces, received ${faces.length}`)
await fs.mkdir('public/fonts', { recursive: true })
const output = []
for (let face of faces) {
  const remote = face.match(/url\(([^)]+)\)/)[1]
  const font = await fetch(remote)
  if (!font.ok) throw new Error(`Font ${font.status}`)
  const bytes = Buffer.from(await font.arrayBuffer())
  const file = createHash('sha256').update(bytes).digest('hex').slice(0, 16) + '.woff2'
  await fs.writeFile(`public/fonts/${file}`, bytes)
  face = face.replace(remote, `/fonts/${file}`)
  output.push(face)
}
await fs.writeFile('public/css/fonts.css', output.join('\n\n') + '\n')
for (const family of ['playfairdisplay', 'montserrat']) {
  const license = await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`)
  if (!license.ok) throw new Error(`Font licence ${family}: ${license.status}`)
  await fs.writeFile(`public/fonts/${family}-OFL.txt`, await license.text())
}
console.log(`Saved ${faces.length} Latin font faces and their licences`)
