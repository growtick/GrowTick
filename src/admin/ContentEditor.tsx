import { useEffect, useState } from 'preact/hooks';
import type { Ctx } from './types';

type FieldType = 'text' | 'textarea' | 'markdown' | 'number' | 'bool' | 'select' | 'service' | 'list';
interface Field { key: string; label: string; type: FieldType; options?: string[]; required?: boolean; createOnly?: boolean; help?: string; max?: number }
interface Config {
  table: string; idKey: string; orderBy: string; noun: string;
  fields: Field[]; titleOf: (r: Row) => string; badge?: (r: Row) => string | null;
  canCreate: boolean; canDelete: boolean; note?: string; blank?: Row;
}
type Row = Record<string, any>;

const PILLARS = ['skill-academy', 'tech-finance', 'web-digital', 'creative-b2b', 'trademark-ip'];

export const CONTENT: Record<'testimonials' | 'faqs' | 'services', Config> = {
  testimonials: {
    table: 'testimonials', idKey: 'id', orderBy: 'sort_order', noun: 'testimonial', canCreate: true, canDelete: true,
    note: 'Only publish real reviews with written consent on file. The live site needs at least 3.',
    titleOf: (r) => `${r.name} — ${r.role}`,
    badge: (r) => (r.sample ? 'sample' : !r.published ? 'hidden' : !r.consent ? 'no consent' : null),
    blank: { name: '', role: '', service: null, rating: 5, photo: '', quote: '', sort_order: 0, consent: false, published: false, sample: false },
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, max: 80 },
      { key: 'role', label: 'Role / business', type: 'text', max: 120 },
      { key: 'service', label: 'Service used', type: 'service' },
      { key: 'rating', label: 'Star rating (1–5, optional)', type: 'number' },
      { key: 'photo', label: 'Photo URL (optional, square, ≤100 KB WebP)', type: 'text' },
      { key: 'quote', label: 'Quote', type: 'textarea', required: true, max: 1000 },
      { key: 'sort_order', label: 'Order (lower shows first)', type: 'number' },
      { key: 'consent', label: 'Written consent received', type: 'bool' },
      { key: 'published', label: 'Show on the website', type: 'bool', help: 'Requires consent.' },
    ],
  },
  faqs: {
    table: 'faqs', idKey: 'id', orderBy: 'sort_order', noun: 'FAQ', canCreate: true, canDelete: true,
    note: 'Keep 8–10 published questions. Answers support Markdown (bold, lists, links).',
    titleOf: (r) => r.question, badge: (r) => (!r.published ? 'hidden' : /TODO/.test(r.answer) ? 'needs answer' : null),
    blank: { id: '', question: '', answer: '', topic: 'general', sort_order: 99, published: true },
    fields: [
      { key: 'id', label: 'ID (e.g. faq-11)', type: 'text', required: true, createOnly: true },
      { key: 'question', label: 'Question', type: 'text', required: true, max: 200 },
      { key: 'answer', label: 'Answer (Markdown)', type: 'markdown', required: true },
      { key: 'topic', label: 'Topic', type: 'select', options: ['general', ...PILLARS] },
      { key: 'sort_order', label: 'Order', type: 'number' },
      { key: 'published', label: 'Show on the website', type: 'bool' },
    ],
  },
  services: {
    table: 'services', idKey: 'slug', orderBy: 'number', noun: 'service', canCreate: false, canDelete: false,
    note: 'Edit service text here. The web address (slug) and number stay fixed so links and search rankings keep working. Use {city} where the city name should appear.',
    titleOf: (r) => `${String(r.number).padStart(2, '0')} · ${r.title}`, badge: (r) => (!r.published ? 'hidden' : null),
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, max: 80 },
      { key: 'hook', label: 'Carousel hook (8 words max)', type: 'text', required: true, max: 70 },
      { key: 'pillar', label: 'Pillar', type: 'select', options: PILLARS },
      { key: 'icon', label: 'Icon', type: 'select', options: ['cap', 'bulb', 'rocket', 'megaphone', 'printer', 'gift', 'handshake', 'scales', 'globe', 'chart', 'pin', 'sparkle', 'play', 'palette', 'box', 'receipt', 'shield'] },
      { key: 'seo_title', label: 'Search title (keyword + “in {city}”)', type: 'text', required: true, max: 70 },
      { key: 'seo_description', label: 'Search description (≤160 characters ideal)', type: 'textarea', required: true, max: 200 },
      { key: 'faqs', label: 'Related FAQ IDs (comma-separated)', type: 'list' },
      { key: 'body', label: 'Page text (Markdown)', type: 'markdown' },
      { key: 'published', label: 'Show on the website', type: 'bool' },
    ],
  },
};

export function ContentEditor({ ctx, config }: { ctx: Ctx; config: Config }) {
  const { db, services } = ctx;
  const [rows, setRows] = useState<Row[]>([]);
  const [edit, setEdit] = useState<Row | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const { data, error } = await db.from(config.table).select('*').order(config.orderBy);
    if (error) return setMsg({ ok: false, text: error.message });
    setRows(data ?? []);
  }
  useEffect(() => { setEdit(null); setMsg(null); load(); }, [config.table]);

  function validate(r: Row): string | null {
    for (const f of config.fields) {
      const v = r[f.key];
      if (f.required && (v === undefined || v === null || String(v).trim() === '')) return `${f.label} is required.`;
      if (f.max && String(v ?? '').length > f.max) return `${f.label} must be ${f.max} characters or fewer.`;
    }
    if (config.table === 'services' && String(r.hook).trim().split(/\s+/).length > 8) return 'The carousel hook must be 8 words or fewer.';
    if (config.table === 'testimonials' && r.published && !r.consent && !r.sample) return 'Tick “Written consent received” before publishing a testimonial.';
    if (config.table === 'faqs' && isNew && !/^[a-z0-9-]{2,60}$/.test(r.id)) return 'ID must use lowercase letters, numbers and hyphens.';
    return null;
  }

  async function save(e: Event) {
    e.preventDefault();
    if (!edit) return;
    const problem = validate(edit);
    if (problem) return setMsg({ ok: false, text: problem });
    const payload: Row = {};
    for (const f of config.fields) if (!(f.createOnly && !isNew)) payload[f.key] = edit[f.key];
    if (payload.rating === '' || payload.rating === 0) payload.rating = null;
    const q = isNew ? db.from(config.table).insert(payload) : db.from(config.table).update(payload).eq(config.idKey, edit[config.idKey]);
    const { error } = await q;
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: `Saved. Click “Publish changes” at the top to update the live site.` });
    setEdit(null);
    load();
  }

  async function remove(r: Row) {
    if (!confirm(`Delete this ${config.noun}? This can’t be undone.`)) return;
    const { error } = await db.from(config.table).delete().eq(config.idKey, r[config.idKey]);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: 'Deleted. Publish to update the live site.' });
    setEdit(null);
    load();
  }

  const set = (k: string, v: unknown) => setEdit((r) => ({ ...r!, [k]: v }));

  function input(f: Field) {
    const v = edit![f.key];
    const disabled = f.createOnly && !isNew;
    switch (f.type) {
      case 'bool': return <label class="check"><input type="checkbox" checked={!!v} onChange={(e) => set(f.key, e.currentTarget.checked)} /> {f.label}</label>;
      case 'textarea': case 'markdown':
        return <label>{f.label}<textarea rows={f.type === 'markdown' ? 14 : 4} value={v ?? ''} onInput={(e) => set(f.key, e.currentTarget.value)} /></label>;
      case 'number': return <label>{f.label}<input type="number" value={v ?? ''} onInput={(e) => set(f.key, e.currentTarget.value === '' ? null : Number(e.currentTarget.value))} /></label>;
      case 'select': return <label>{f.label}<select value={v} onChange={(e) => set(f.key, e.currentTarget.value)}>{f.options!.map((o) => <option value={o}>{o}</option>)}</select></label>;
      case 'service': return (
        <label>{f.label}<select value={v ?? ''} onChange={(e) => set(f.key, e.currentTarget.value || null)}>
          <option value="">—</option>{services.map((s) => <option value={s.slug}>{s.title}</option>)}
        </select></label>
      );
      case 'list': return <label>{f.label}<input value={(v ?? []).join(', ')} onInput={(e) => set(f.key, e.currentTarget.value.split(',').map((x) => x.trim()).filter(Boolean))} /></label>;
      default: return <label>{f.label}<input value={v ?? ''} disabled={disabled} onInput={(e) => set(f.key, e.currentTarget.value)} /></label>;
    }
  }

  return (
    <section class="adm-panel">
      <div class="adm-row"><h1 class="h2">{config.noun[0].toUpperCase() + config.noun.slice(1)}s</h1>
        {config.canCreate && !edit && <button class="btn btn--sm" onClick={() => { setIsNew(true); setEdit({ ...config.blank }); setMsg(null); }}>Add {config.noun}</button>}
      </div>
      {config.note && <p class="muted">{config.note}</p>}
      {msg && <p class={`adm-msg ${msg.ok ? 'adm-msg--ok' : 'adm-msg--err'}`} role="status">{msg.text}</p>}

      {edit ? (
        <form class="adm-form" onSubmit={save}>
          <h2 class="h3">{isNew ? `New ${config.noun}` : config.titleOf(edit)}</h2>
          {config.fields.map((f) => <div>{input(f)}{f.help && <small class="muted">{f.help}</small>}</div>)}
          <div class="adm-row">
            <button class="btn">Save</button>
            <button type="button" class="btn btn--ghost" onClick={() => setEdit(null)}>Cancel</button>
            {config.canDelete && !isNew && <button type="button" class="btn btn--ghost" onClick={() => remove(edit)}>Delete</button>}
          </div>
        </form>
      ) : (
        <ul class="adm-list">
          {rows.map((r) => (
            <li><button class="item" onClick={() => { setIsNew(false); setEdit({ ...r }); setMsg(null); }}>
              <span>{config.titleOf(r)}</span>
              {config.badge?.(r) && <span class="adm-badge adm-badge--warn">{config.badge(r)}</span>}
            </button></li>
          ))}
          {!rows.length && <li class="muted">Nothing here yet.</li>}
        </ul>
      )}
    </section>
  );
}
