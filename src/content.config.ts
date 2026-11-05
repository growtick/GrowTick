import { defineCollection } from 'astro:content';
import { glob, type Loader } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Content source:
 *  - If SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set at build time, content
 *    comes from the database (what admins edit).
 *  - Otherwise it comes from /content/*.md (local dev, and disaster recovery:
 *    the weekly Markdown backup can rebuild the whole site).
 * Both sources produce the same shape: frontmatter fields + `body` markdown.
 */
const DB_URL = process.env.SUPABASE_URL;
const DB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const useDb = Boolean(DB_URL && DB_KEY);

type Row = Record<string, unknown>;

function hybrid(name: string, table: string, pattern: string, toEntry: (row: Row) => { id: string; data: Row; body: string }): Loader {
  const md = glob({ pattern, base: `./content/${name}` });
  if (!useDb) return md;
  return {
    name: `supabase-${table}`,
    async load({ store, parseData, logger, renderMarkdown }) {
      const res = await fetch(`${DB_URL}/rest/v1/${table}?select=*`, {
        headers: { apikey: DB_KEY!, Authorization: `Bearer ${DB_KEY}` },
      });
      if (!res.ok) throw new Error(`Supabase ${table}: ${res.status} ${await res.text()}`);
      const rows = (await res.json()) as Row[];
      store.clear();
      for (const row of rows) {
        const { id, data, body } = toEntry(row);
        const parsed = await parseData({ id, data });
        store.set({ id, data: parsed, body, rendered: await renderMarkdown(body) });
      }
      logger.info(`Loaded ${rows.length} ${table} rows from Supabase`);
    },
  };
}

const services = defineCollection({
  loader: hybrid('services', 'services', '*.md', (r) => ({
    id: String(r.slug),
    body: String(r.body ?? ''),
    data: {
      number: r.number, slug: r.slug, pillar: r.pillar, title: r.title, hook: r.hook, icon: r.icon,
      seoTitle: r.seo_title, seoDescription: r.seo_description, faqs: r.faqs ?? [], published: r.published,
    },
  })),
  schema: z.object({
    number: z.number().int().min(1).max(99),
    slug: z.string(),
    pillar: z.enum(['skill-academy', 'tech-finance', 'web-digital', 'creative-b2b', 'trademark-ip']),
    title: z.string(),
    hook: z.string().refine((s) => s.split(/\s+/).length <= 8, 'Carousel hook must be 8 words or fewer'),
    icon: z.string(),
    seoTitle: z.string(),
    seoDescription: z.string(),
    faqs: z.array(z.string()).default([]),
    published: z.boolean().default(true),
  }),
});

const faqs = defineCollection({
  loader: hybrid('faqs', 'faqs', '*.md', (r) => ({
    id: String(r.id),
    body: String(r.answer ?? ''),
    data: { id: r.id, order: r.sort_order, question: r.question, topic: r.topic, published: r.published },
  })),
  schema: z.object({
    id: z.string(),
    order: z.number().int(),
    question: z.string(),
    topic: z.string().default('general'),
    published: z.boolean().default(true),
  }),
});

const testimonials = defineCollection({
  loader: hybrid('testimonials', 'testimonials', '*.md', (r) => ({
    id: String(r.id),
    body: String(r.quote ?? ''),
    data: {
      id: r.id, name: r.name, role: r.role, service: r.service, rating: r.rating, photo: r.photo ?? '',
      order: r.sort_order, sample: r.sample, consent: r.consent, published: r.published,
    },
  })),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    role: z.string(),
    service: z.string().optional(),
    rating: z.number().int().min(1).max(5).optional(),
    photo: z.string().optional(),
    order: z.number().int().default(0),
    sample: z.boolean().default(false),
    consent: z.boolean().default(false),
    published: z.boolean().default(true),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/pages' }),
  schema: z.object({ title: z.string(), seoTitle: z.string(), seoDescription: z.string() }),
});

export const collections = { services, faqs, testimonials, pages };
