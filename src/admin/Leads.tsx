import { useEffect, useState } from 'preact/hooks';
import { fmtDate, type Ctx } from './types';

const STATUSES = ['new', 'contacted', 'converted', 'closed'] as const;
type Status = (typeof STATUSES)[number];
interface Lead {
  id: string; created_at: string; name: string; phone: string; email: string | null; service: string;
  message: string | null; source: string | null; status: Status; email_alert_sent: boolean;
}

export function Leads({ ctx }: { ctx: Ctx }) {
  const { db, profile, services } = ctx;
  const canUpdate = profile.role !== 'viewer';
  const [rows, setRows] = useState<Lead[]>([]);
  const [service, setService] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const title = (slug: string) => (slug === 'other' ? 'Other' : services.find((s) => s.slug === slug)?.title ?? slug);

  async function load() {
    setLoading(true);
    let q = db.from('leads').select('*').order('created_at', { ascending: false }).limit(1000);
    if (service) q = q.eq('service', service);
    if (status) q = q.eq('status', status);
    if (from) q = q.gte('created_at', new Date(from).toISOString());
    if (to) q = q.lt('created_at', new Date(new Date(to).getTime() + 86_400_000).toISOString());
    const { data, error } = await q;
    setLoading(false);
    if (error) return setErr(error.message);
    setErr(''); setRows(data as Lead[]);
  }
  useEffect(() => { load(); }, [service, status, from, to]);

  async function setLeadStatus(id: string, s: Status) {
    const { error } = await db.from('leads').update({ status: s }).eq('id', id);
    if (error) return setErr(error.message);
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status: s } : x)));
  }

  async function remove(l: Lead) {
    if (!confirm(`Permanently delete the enquiry from ${l.name}? Use this for data-deletion requests.`)) return;
    const { error } = await db.from('leads').delete().eq('id', l.id);
    if (error) return setErr(error.message);
    setRows((r) => r.filter((x) => x.id !== l.id));
  }

  function exportCsv() {
    const head = ['Received', 'Name', 'Phone', 'Email', 'Service', 'Message', 'Page', 'Status'];
    const esc = (v: unknown) => {
      let s = String(v ?? '');
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = rows.map((l) => [l.created_at, l.name, `+91${l.phone}`, l.email, title(l.service), l.message, l.source, l.status].map(esc).join(','));
    const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `growtick-leads-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section class="adm-panel">
      <h1 class="h2">Leads</h1>
      <div class="adm-filters">
        <label>Service
          <select value={service} onChange={(e) => setService(e.currentTarget.value)}>
            <option value="">All services</option>
            {services.map((s) => <option value={s.slug}>{String(s.number).padStart(2, '0')} · {s.title}</option>)}
            <option value="other">Other</option>
          </select>
        </label>
        <label>Status
          <select value={status} onChange={(e) => setStatus(e.currentTarget.value)}>
            <option value="">All</option>
            {STATUSES.map((s) => <option value={s}>{s}</option>)}
          </select>
        </label>
        <label>From<input type="date" value={from} onChange={(e) => setFrom(e.currentTarget.value)} /></label>
        <label>To<input type="date" value={to} onChange={(e) => setTo(e.currentTarget.value)} /></label>
        <button class="btn btn--sm btn--ghost" onClick={load}>Refresh</button>
        <button class="btn btn--sm" onClick={exportCsv} disabled={!rows.length}>Export CSV ({rows.length})</button>
      </div>
      {err && <p class="adm-msg adm-msg--err" role="alert">{err}</p>}
      {loading ? <p>Loading…</p> : rows.length === 0 ? <p class="muted">No leads match these filters.</p> : (
        <div class="adm-table-wrap">
          <table>
            <thead><tr><th>Received</th><th>Name</th><th>Phone</th><th>Service</th><th>Message</th><th>Status</th>{profile.role === 'owner' && <th />}</tr></thead>
            <tbody>
              {rows.map((l) => (
                <tr>
                  <td>{fmtDate(l.created_at)}{!l.email_alert_sent && <><br /><span class="adm-badge adm-badge--warn" title="The email alert failed to send">no email alert</span></>}</td>
                  <td>{l.name}{l.email && <><br /><a href={`mailto:${l.email}`}>{l.email}</a></>}</td>
                  <td><a href={`tel:+91${l.phone}`}>+91 {l.phone}</a><br /><a href={`https://wa.me/91${l.phone}`} target="_blank" rel="noopener">WhatsApp</a></td>
                  <td>{title(l.service)}<br /><span class="muted">{l.source}</span></td>
                  <td>{l.message}</td>
                  <td>
                    {canUpdate ? (
                      <select value={l.status} aria-label={`Status for ${l.name}`} onChange={(e) => setLeadStatus(l.id, e.currentTarget.value as Status)}>
                        {STATUSES.map((s) => <option value={s}>{s}</option>)}
                      </select>
                    ) : <span class={`adm-badge ${l.status === 'new' ? 'adm-badge--new' : ''}`}>{l.status}</span>}
                  </td>
                  {profile.role === 'owner' && <td><button class="btn btn--sm btn--ghost" onClick={() => remove(l)}>Delete</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
