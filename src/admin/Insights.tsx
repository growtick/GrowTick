import { useEffect, useState } from 'preact/hooks';
import type { Ctx } from './types';

const LABELS: Record<string, string> = {
  call: 'Call taps', whatsapp: 'WhatsApp taps', form_submit: 'Form enquiries', enquire: '“Enquire” clicks', share: 'WhatsApp shares', instagram: 'Instagram clicks',
};

/** Conversion counts for the last 30 days (PRD success metric: 3%+ of visitors convert). */
export function Insights({ ctx }: { ctx: Ctx }) {
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [top, setTop] = useState<[string, number][]>([]);
  const [leads, setLeads] = useState(0);
  const [err, setErr] = useState('');

  useEffect(() => {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    ctx.db.from('events').select('name, label, path, count').gte('day', since).then(({ data, error }) => {
      if (error) return setErr(error.message);
      const t: Record<string, number> = {};
      const pages: Record<string, number> = {};
      for (const e of data ?? []) {
        t[e.name] = (t[e.name] ?? 0) + e.count;
        if (['call', 'whatsapp', 'form_submit'].includes(e.name)) pages[e.path || '/'] = (pages[e.path || '/'] ?? 0) + e.count;
      }
      setTotals(t);
      setTop(Object.entries(pages).sort((a, b) => b[1] - a[1]).slice(0, 10));
    });
    ctx.db.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', since).then(({ count }) => setLeads(count ?? 0));
  }, []);

  const conversions = (totals.call ?? 0) + (totals.whatsapp ?? 0) + (totals.form_submit ?? 0);
  return (
    <section class="adm-panel">
      <h1 class="h2">Insights — last 30 days</h1>
      {err && <p class="adm-msg adm-msg--err">{err}</p>}
      <div class="adm-stats">
        <div class="adm-stat"><span>Total conversions</span><b>{conversions}</b></div>
        <div class="adm-stat"><span>Leads saved</span><b>{leads}</b></div>
        {Object.entries(LABELS).map(([k, l]) => <div class="adm-stat"><span>{l}</span><b>{totals[k] ?? 0}</b></div>)}
      </div>
      <p class="muted">Conversion rate = total conversions ÷ visitors. Visitor numbers are in Cloudflare Web Analytics (dashboard → Analytics & Logs → Web Analytics).</p>
      <h2 class="h3">Pages that convert best</h2>
      <table><thead><tr><th>Page</th><th>Calls + WhatsApp + forms</th></tr></thead>
        <tbody>{top.map(([p, n]) => <tr><td>{p}</td><td>{n}</td></tr>)}</tbody></table>
    </section>
  );
}
