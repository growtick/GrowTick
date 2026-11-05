import { useEffect, useState } from 'preact/hooks';
import { fmtDate, type Ctx } from './types';

interface Entry { id: number; at: string; actor_email: string | null; action: string; table_name: string; row_id: string | null; before: unknown; after: unknown }

/** Fields that changed between before/after (for a compact summary). */
function changed(b: any, a: any): string {
  if (!b || !a) return '';
  return Object.keys(a).filter((k) => !['updated_at', 'updated_by'].includes(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k])).join(', ');
}

export function Activity({ ctx }: { ctx: Ctx }) {
  const [rows, setRows] = useState<Entry[]>([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    ctx.db.from('activity_log').select('*').order('at', { ascending: false }).limit(200)
      .then(({ data, error }) => (error ? setErr(error.message) : setRows(data as Entry[])));
  }, []);

  return (
    <section class="adm-panel">
      <h1 class="h2">Activity log</h1>
      <p class="muted">Who changed what — last 200 entries.</p>
      {err && <p class="adm-msg adm-msg--err">{err}</p>}
      <div class="adm-table-wrap">
        <table>
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>What</th><th>Details</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr>
                <td>{fmtDate(r.at)}</td>
                <td>{r.actor_email ?? <span class="muted">system</span>}</td>
                <td><span class="adm-badge">{r.action}</span></td>
                <td>{r.table_name}{r.row_id && <><br /><span class="muted">{r.row_id}</span></>}</td>
                <td>
                  {r.action === 'update' && <span>Changed: {changed(r.before, r.after) || '—'}</span>}
                  {(r.before || r.after) && (
                    <details><summary>Show data</summary><pre>{JSON.stringify({ before: r.before, after: r.after }, null, 2)}</pre></details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
