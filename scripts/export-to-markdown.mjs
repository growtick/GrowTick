// Exports database content to /content/*.md so the Git repo always holds a full,
// human-readable backup (PRD §06 "MD file backup"). Run weekly by GitHub Actions.
// Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run export:md
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function all(table, order) {
  const { data, error } = await db.from(table).select('*').order(order);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}
function writeDir(dir, files) {
  const path = join('content', dir);
  mkdirSync(path, { recursive: true });
  for (const f of readdirSync(path)) if (f.endsWith('.md')) rmSync(join(path, f));
  for (const [name, body, data] of files) writeFileSync(join(path, name), matter.stringify(`\n${body.trim()}\n`, data));
  console.log(`✓ ${dir}: ${files.length} files`);
}

writeDir('services', (await all('services', 'number')).map((r) => [
  `${String(r.number).padStart(2, '0')}-${r.slug}.md`, r.body,
  { number: r.number, slug: r.slug, pillar: r.pillar, title: r.title, hook: r.hook, icon: r.icon, seoTitle: r.seo_title, seoDescription: r.seo_description, faqs: r.faqs, published: r.published },
]));
writeDir('faqs', (await all('faqs', 'sort_order')).map((r) => [
  `${r.id}.md`, r.answer, { id: r.id, order: r.sort_order, question: r.question, topic: r.topic, published: r.published },
]));
writeDir('testimonials', (await all('testimonials', 'sort_order')).map((r) => [
  `${r.id}.md`, r.quote,
  { id: r.id, name: r.name, role: r.role, service: r.service ?? '', rating: r.rating ?? undefined, photo: r.photo, order: r.sort_order, sample: r.sample, consent: r.consent, published: r.published },
].map((x) => (typeof x === 'object' && x ? JSON.parse(JSON.stringify(x)) : x))));
