import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { load } from 'cheerio';

const origin = 'https://www.gulabandco.com.au';
const pageNames = ['index', 'about', 'services', 'process', 'contact', 'thank-you'];
const pages = new Map(pageNames.map((name) => {
  const html = fs.readFileSync(`public/${name}.html`, 'utf8');
  return [name === 'index' ? '/' : `/${name}`, { name, html, $: load(html) }];
}));
let checks = 0;
const check = (condition, message) => { checks++; assert.ok(condition, message); };
const asset = (url) => path.join('public', decodeURIComponent(new URL(url, origin).pathname));
const titles = new Set();
const descriptions = new Set();

for (const [route, { name, html, $ }] of pages) {
  check($('html').attr('lang') === 'en-AU', `${name}: Australian English language`);
  check($('h1').length === 1, `${name}: exactly one h1`);
  check($('title').text().length > 0 && !titles.has($('title').text()), `${name}: unique title`);
  titles.add($('title').text());
  check(!/fonts\.(googleapis|gstatic)\.com/.test(html), `${name}: fonts are local`);
  check($('link[href="/css/fonts.css"]').length === 1, `${name}: local font stylesheet`);
  check(!/data-netlify|netlify-honeypot|\snetlify[=>\s]/.test(html), `${name}: no unsupported Netlify forms`);
  check(!/Savings that exceed our fee|saving far more than our fee|\$45k|\$80k/.test(html), `${name}: unverified savings claims held`);
  if (name !== 'thank-you') {
    const description = $('meta[name="description"]').attr('content');
    check(Boolean(description) && !descriptions.has(description), `${name}: unique description`);
    descriptions.add(description);
    check($('link[rel="canonical"]').length === 1 && $('link[rel="canonical"]').attr('href') === origin + route, `${name}: intended production canonical`);
    check($('meta[property="og:url"]').attr('content') === origin + route, `${name}: consistent social URL`);
    check(fs.existsSync(asset($('meta[property="og:image"]').attr('content'))), `${name}: existing social image`);
    check(!/noindex/.test($('meta[name="robots"]').attr('content') || ''), `${name}: no production noindex`);
    check($('dialog.mobile-nav').length === 1, `${name}: native modal mobile navigation`);
    check($('.nav-toggle').attr('aria-controls') === $('dialog.mobile-nav').attr('id'), `${name}: connected mobile navigation trigger`);
  } else {
    check(/noindex/.test($('meta[name="robots"]').attr('content') || ''), 'thank-you: excluded from indexing');
  }
  const ids = new Set();
  $('[id]').each((_, el) => {
    const id = $(el).attr('id');
    check(!ids.has(id), `${name}: unique ID ${id}`);
    ids.add(id);
  });
  $('img, script[src], link[rel="stylesheet"], link[rel="preload"], link[rel="icon"]').each((_, el) => {
    const url = $(el).attr('src') || $(el).attr('href');
    check(url?.startsWith('/') && fs.existsSync(asset(url)), `${name}: existing local asset ${url}`);
  });
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (/^(?:https?:|mailto:|tel:)/.test(href)) return;
    check(href.startsWith('/') || href.startsWith('#'), `${name}: absolute internal link ${href}`);
    const url = new URL(href, origin + route);
    const target = pages.get(url.pathname);
    check(Boolean(target), `${name}: existing route ${href}`);
    if (target && url.hash) check(target.$('[id]').toArray().some((el) => target.$(el).attr('id') === decodeURIComponent(url.hash.slice(1))), `${name}: existing anchor ${href}`);
  });
  $('img').each((_, el) => {
    const img = $(el);
    check(img.attr('alt') !== undefined && Number(img.attr('width')) > 0 && Number(img.attr('height')) > 0, `${name}: image text alternative and dimensions`);
    if (!img.attr('src').includes('/images/')) return;
    check(img.attr('src').endsWith('.webp'), `${name}: optimized photo`);
    check(Boolean(img.attr('srcset')) && Boolean(img.attr('sizes')), `${name}: responsive photo`);
    img.attr('srcset').split(',').forEach((entry) => check(fs.existsSync(asset(entry.trim().split(/\s+/)[0])), `${name}: existing srcset candidate`));
    const isHero = img.closest('.hero-cinematic__bg, .page-hero__bg').length > 0;
    check(img.attr('loading') === (isHero ? 'eager' : 'lazy'), `${name}: appropriate photo loading`);
    check(isHero ? img.attr('fetchpriority') === 'high' : !img.attr('fetchpriority'), `${name}: only hero has high priority`);
  });
  $('[data-count]').each((_, el) => check($(el).text() === $(el).attr('data-count') + ($(el).attr('data-suffix') || ''), `${name}: final counter visible in HTML`));
}

const about = pages.get('/about').$;
check(about('details.diff-accordion__item').length === 3, 'About: all panels use native details');
about('details.diff-accordion__item').each((_, el) => check(about(el).children().first().is('summary') && !about(el).find('.diff-accordion__panel').is('[hidden]'), 'About: summary first and panel available without scripts'));
const contact = pages.get('/contact').$;
const form = contact('#enquiry-form');
check(form.attr('action') === '/api/enquiry' && form.attr('method').toUpperCase() === 'POST', 'Contact: supported API target');
check(form.find('fieldset[data-enquiry-fields]').is('[disabled]'), 'Contact: fail closed until receiver is ready');
check(form.find('[data-enquiry-status][role="status"]').length === 1 && form.find('[data-enquiry-status]').closest('fieldset').length === 0, 'Contact: status available outside disabled controls');
for (const name of ['request-id', 'first-name', 'last-name', 'email', 'phone', 'buyer-type', 'location', 'message', 'bot-field']) check(form.find(`[name="${name}"]`).length === 1, `Contact: ${name} field`);
check(form.find('.contact-form__fallback a[href="tel:+61411308747"]').length === 1 && form.find('.contact-form__fallback a[href="mailto:vinaygandhi@y7mail.com"]').length === 1, 'Contact: usable phone and alternate email fallback');
check(contact('script[src="/js/enquiry.js"][defer]').length === 1, 'Contact: enquiry progressive enhancement script');
check(pages.get('/').$('.reviews__track').length === 0, 'Home: unverified testimonial section held');
check(pages.get('/process').$('h3').toArray().some((el) => pages.get('/process').$(el).text() === 'Budget and purchase price'), 'Process: clarified budget comparison');
const css = fs.readFileSync('public/css/styles.css', 'utf8');
const sitemap = load(fs.readFileSync('public/sitemap.xml', 'utf8'), { xmlMode: true });
const urls = sitemap('loc').toArray().map((el) => sitemap(el).text());
check(JSON.stringify(urls) === JSON.stringify([...pages.keys()].filter((route) => route !== '/thank-you').map((route) => origin + route)), 'Sitemap: exactly the five canonical business routes');
check(fs.readFileSync('public/robots.txt', 'utf8').includes(`Sitemap: ${origin}/sitemap.xml`), 'Robots: canonical sitemap location');
for (const selector of ['rise', 'fade-up']) check(new RegExp(`\\.${selector} \\{[^}]*opacity: 1;[^}]*transform: none;`).test(css), `${selector}: visible before scripts`);
console.log(`Passed ${checks} static site checks across ${pages.size} pages.`);
