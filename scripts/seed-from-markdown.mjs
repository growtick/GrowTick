// Loads /content/*.md into Supabase (first setup, or disaster recovery from the Git backup).
// Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run seed [-- --with-samples]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const withSamples = process.argv.includes('--with-samples');
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const read = (dir) => readdirSync(join('content', dir)).filter((f) => f.endsWith('.md'))
  .map((f) => matter(readFileSync(join('content', dir, f), 'utf8')));

async function upsert(table, rows, onConflict) {
  const { error } = await db.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`✓ ${table}: ${rows.length} rows`);
}

await upsert('services', read('services').map(({ data: d, content }) => ({
  slug: d.slug, number: d.number, pillar: d.pillar, title: d.title, hook: d.hook, icon: d.icon,
  seo_title: d.seoTitle, seo_description: d.seoDescription, faqs: d.faqs ?? [], body: content.trim(), published: d.published ?? true,
})), 'slug');

await upsert('faqs', read('faqs').map(({ data: d, content }) => ({
  id: d.id, sort_order: d.order, question: d.question, answer: content.trim(), topic: d.topic ?? 'general', published: d.published ?? true,
})), 'id');

const testimonials = read('testimonials').filter(({ data }) => withSamples || !data.sample);
if (testimonials.length) await upsert('testimonials', testimonials.map(({ data: d, content }) => ({
  id: d.id, name: d.name, role: d.role ?? '', service: d.service ?? null, rating: d.rating ?? null, photo: d.photo ?? '',
  quote: content.trim(), sort_order: d.order ?? 0, sample: !!d.sample, consent: !!d.consent, published: !!d.published,
})), 'id');
console.log('Done. Samples', withSamples ? 'included' : 'skipped (pass --with-samples to include)');
