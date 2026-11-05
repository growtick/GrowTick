// Checks the built site against the PRD budgets and SEO rules.
//   npm run build && npm run check:budgets            → budgets + SEO (CI)
//   npm run check:budgets -- --strict                 → also fails on launch blockers (placeholders, sample reviews)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = 'dist/client';
const strict = process.argv.includes('--strict');
const errors = [];
const warns = [];
const fail = (m) => errors.push(m);
const warn = (m) => warns.push(m);

if (!existsSync(ROOT)) { console.error('Run `npm run build` first.'); process.exit(1); }
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const pages = walk(ROOT).filter((f) => f.endsWith('.html'));
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const gz = (buf) => gzipSync(buf, { level: 9 }).length;

/** Every request a page makes on first load (local files only; external ones are counted but not sized). */
function pageCost(file) {
  const html = readFileSync(file, 'utf8');
  const seen = new Set();
  let bytes = gz(Buffer.from(html)), js = 0, requests = 1, external = 0;
  const queue = [];
  for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) queue.push(m[1]);
  for (const m of html.matchAll(/<link[^>]+rel="(?:preload|stylesheet|modulepreload)"[^>]+href="([^"]+)"/g)) queue.push(m[1]);
  for (const m of html.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/g)) if (!/loading="lazy"/.test(m[0])) queue.push(m[1]);
  // Inline module scripts can import chunks too.
  for (const m of html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)) {
    js += gz(Buffer.from(m[1]));
    for (const i of m[1].matchAll(/from\s*"([^"]+\.js)"|import\s*"([^"]+\.js)"/g)) queue.push(i[1] ?? i[2]);
  }
  while (queue.length) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    if (/^https?:/.test(url)) { external++; requests++; continue; }
    const path = join(ROOT, url.replace(/^\//, ''));
    if (!existsSync(path)) { fail(`${rel(file)}: missing asset ${url}`); continue; }
    const buf = readFileSync(path);
    const size = /\.(woff2|png|webp|avif|jpg)$/.test(path) ? buf.length : gz(buf);
    bytes += size; requests++;
    if (path.endsWith('.js')) {
      js += size;
      for (const i of buf.toString().matchAll(/(?:from|import)\s*["']\.?\.?\/?([^"']+\.js)["']/g)) queue.push(`/_astro/${i[1].split('/').pop()}`);
    }
  }
  return { bytes, js, requests, external };
}
const rel = (f) => '/' + relative(ROOT, f).replace(/\\/g, '/');

// ---- Budgets (PRD §03 home page budget, §06 performance)
const home = pageCost(join(ROOT, 'index.html'));
console.log(`Home: ${kb(home.bytes)} transfer (gzip), ${kb(home.js)} JS, ${home.requests} requests`);
if (home.bytes > 500 * 1024) fail(`Home transfer ${kb(home.bytes)} > 500 KB`);
if (home.js > 50 * 1024) fail(`Home JS ${kb(home.js)} > 50 KB`);
if (home.requests >= 15) fail(`Home makes ${home.requests} requests (budget: under 15)`);

let worst = { bytes: 0, page: '' };
for (const p of pages) {
  if (p.endsWith('index.html')) continue;
  const c = pageCost(p);
  if (c.bytes > worst.bytes) worst = { bytes: c.bytes, page: rel(p) };
  if (c.bytes > 1024 * 1024) fail(`${rel(p)}: ${kb(c.bytes)} > 1 MB`);
  if (c.js > 150 * 1024) fail(`${rel(p)}: JS ${kb(c.js)} > 150 KB`);
}
console.log(`Heaviest inner page: ${worst.page} (${kb(worst.bytes)})`);

// ---- Structure
const servicePages = pages.filter((p) => /[\\/]services[\\/][^\\/]+\.html$/.test(p));
if (servicePages.length !== 19) fail(`Expected 19 service pages, found ${servicePages.length}`);
const homeHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');
const mainHtml = homeHtml.slice(homeHtml.indexOf('<main'), homeHtml.indexOf('</main>'));
const sections = (mainHtml.match(/<section\b/g) ?? []).length;
if (sections !== 3) fail(`Home page must have exactly 3 sections (hero, services, contact); found ${sections}`);
if (!/data-carousel/.test(homeHtml)) fail('Home page carousel missing');

// ---- SEO / a11y basics on every indexable page
const titles = new Map(), descs = new Map();
for (const p of pages) {
  const html = readFileSync(p, 'utf8');
  const r = rel(p);
  const noindex = /name="robots" content="noindex/.test(html);
  const h1 = (html.match(/<h1\b/g) ?? []).length;
  if (h1 !== 1) fail(`${r}: ${h1} <h1> elements (need exactly 1)`);
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
  if (!title) fail(`${r}: missing <title>`);
  if (!desc) fail(`${r}: missing meta description`);
  if (!noindex) {
    if (titles.has(title)) fail(`${r}: duplicate title with ${titles.get(title)}`); else titles.set(title, r);
    if (descs.has(desc)) fail(`${r}: duplicate description with ${descs.get(desc)}`); else descs.set(desc, r);
    if (!/<link rel="canonical" href="https:\/\/[^"]+"/.test(html)) fail(`${r}: missing canonical`);
    if (/\{city\}/.test(html)) fail(`${r}: unreplaced {city} token`);
  }
  for (const m of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) if (!/rel="[^"]*noopener/.test(m[0])) fail(`${r}: target=_blank link without rel=noopener`);
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt=/.test(m[0])) fail(`${r}: <img> without alt`);
  if (!/http-equiv="content-security-policy"/i.test(html)) fail(`${r}: missing CSP meta tag`);
}
for (const f of ['robots.txt', 'sitemap-index.xml', 'favicon.svg', 'favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png', 'icon-512.png', 'site.webmanifest', 'og-default.png', '404.html', '_headers'])
  if (!existsSync(join(ROOT, f))) fail(`Missing /${f}`);

// ---- Launch blockers (placeholders, sample content)
const site = readFileSync('src/config/site.ts', 'utf8');
const oq = [...site.matchAll(/TODO\(PRD-OQ#(\d)\)[^\n]*/g)].map((m) => m[0].trim());
const todoContent = walk('content').filter((f) => /TODO/.test(readFileSync(f, 'utf8'))).map((f) => f.replace(/\\/g, '/'));
const testimonialsHtml = readFileSync(join(ROOT, 'testimonials.html'), 'utf8');
const blockers = [
  ...oq.map((t) => `Placeholder in src/config/site.ts: ${t}`),
  ...todoContent.map((f) => `Placeholder text in ${f}`),
  ...(/Sample — not shown on the live site/.test(testimonialsHtml) ? ['Sample testimonials are in this build (SHOW_SAMPLES=1 or dev)'] : []),
  ...(/Reviews are coming soon/.test(testimonialsHtml) ? ['Testimonials page is empty — PRD needs at least 3 real, consented reviews'] : []),
  ...((testimonialsHtml.match(/<figure class="tst/g) ?? []).length / 2 < 3 && !/coming soon/.test(testimonialsHtml) ? ['Fewer than 3 testimonials'] : []),
];
(strict ? blockers.forEach(fail) : blockers.forEach(warn));

warns.forEach((w) => console.warn(`⚠ ${w}`));
if (errors.length) { errors.forEach((e) => console.error(`✗ ${e}`)); process.exit(1); }
console.log(`✓ All checks passed${strict ? ' (strict)' : ''} — ${pages.length} pages`);
