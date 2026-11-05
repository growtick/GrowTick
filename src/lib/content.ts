import { getCollection, type CollectionEntry } from 'astro:content';
import { Marked } from 'marked';
import { site, pillars } from '../config/site';

export type Service = CollectionEntry<'services'>;
export type Faq = CollectionEntry<'faqs'>;
export type Testimonial = CollectionEntry<'testimonials'>;

/** Sample testimonials only show in dev or preview builds (SHOW_SAMPLES=1). */
const showSamples = import.meta.env.DEV || process.env.SHOW_SAMPLES === '1';

/** Replace {city} tokens so the city lives only in src/config/site.ts. */
export const cityfy = (s: string) => s.replaceAll('{city}', site.address.city);

// Raw HTML in admin-edited Markdown is dropped, so content can't inject scripts.
const md = new Marked({ gfm: true, renderer: { html: () => '' } });
export const renderMd = (s: string) => md.parse(cityfy(s ?? ''), { async: false }) as string;

export async function getServices(): Promise<Service[]> {
  const all = await getCollection('services', (s) => s.data.published);
  return all.sort((a, b) => a.data.number - b.data.number);
}

export async function getFaqs(): Promise<Faq[]> {
  const all = await getCollection('faqs', (f) => f.data.published);
  return all.sort((a, b) => a.data.order - b.data.order);
}

export async function getTestimonials(): Promise<Testimonial[]> {
  const all = await getCollection('testimonials', (t) =>
    t.data.published && (t.data.sample ? showSamples : t.data.consent),
  );
  return all.sort((a, b) => a.data.order - b.data.order);
}

export const pad2 = (n: number) => String(n).padStart(2, '0');
export const pillarName = (id: string) => pillars.find((p) => p.id === id)?.name ?? id;

/** "/services/x.html" or "/index.html" → clean public path ("/services/x", "/"). */
export const cleanPath = (p: string) => p.replace(/\.html$/, '').replace(/\/index$/, '').replace(/\/$/, '') || '/';
