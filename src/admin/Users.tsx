import { useEffect, useState } from 'preact/hooks';
import type { Ctx, Profile, Role } from './types';

const ROLES: Role[] = ['owner', 'editor', 'viewer'];
const ROLE_HELP: Record<Role, string> = {
  owner: 'Everything, including users',
  editor: 'Content, testimonials, FAQs; read leads and change their status',
  viewer: 'Read leads only',
};

export function Users({ ctx }: { ctx: Ctx }) {
  const { db, profile, token } = ctx;
  const [users, setUsers] = useState<Profile[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const { data, error } = await db.from('profiles').select('id, email, full_name, role').order('email');
    if (error) return setMsg({ ok: false, text: error.message });
    setUsers(data as Profile[]);
  }
  useEffect(() => { load(); }, []);
  const owners = users.filter((u) => u.role === 'owner').length;

  async function call(method: 'POST' | 'DELETE', body: object) {
    const res = await fetch('/api/admin/users', {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? null : (data.error ?? `Request failed (${res.status})`);
  }

  async function invite(e: Event) {
    e.preventDefault();
    const err = await call('POST', { email, role });
    setMsg(err ? { ok: false, text: err } : { ok: true, text: `Invite sent to ${email}. They’ll set a password and 2FA on first login.` });
    if (!err) { setEmail(''); load(); }
  }

  async function changeRole(u: Profile, r: Role) {
    const { error } = await db.from('profiles').update({ role: r }).eq('id', u.id);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: `${u.email} is now ${r}.` });
    load();
  }

  async function remove(u: Profile) {
    if (!confirm(`Remove ${u.email}? They will lose access immediately.`)) return;
    const err = await call('DELETE', { id: u.id });
    setMsg(err ? { ok: false, text: err } : { ok: true, text: `${u.email} removed.` });
    load();
  }

  return (
    <section class="adm-panel">
      <h1 class="h2">Users</h1>
      {owners < 2 && <p class="adm-msg adm-msg--err">The PRD requires at least 2 owner-level admins (“no single master”). There is currently {owners}.</p>}
      {msg && <p class={`adm-msg ${msg.ok ? 'adm-msg--ok' : 'adm-msg--err'}`} role="status">{msg.text}</p>}
      <div class="adm-table-wrap">
        <table>
          <thead><tr><th>Email</th><th>Role</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr>
                <td>{u.email}{u.id === profile.id && <span class="muted"> (you)</span>}</td>
                <td>
                  <select value={u.role} aria-label={`Role for ${u.email}`} disabled={u.id === profile.id} onChange={(e) => changeRole(u, e.currentTarget.value as Role)}>
                    {ROLES.map((r) => <option value={r}>{r}</option>)}
                  </select>
                </td>
                <td>{u.id !== profile.id && <button class="btn btn--sm btn--ghost" onClick={() => remove(u)}>Remove</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 class="h3 mt">Invite an admin</h2>
      <form class="adm-filters" onSubmit={invite}>
        <label>Email<input type="email" required value={email} onInput={(e) => setEmail(e.currentTarget.value)} /></label>
        <label>Role
          <select value={role} onChange={(e) => setRole(e.currentTarget.value as Role)}>{ROLES.map((r) => <option value={r}>{r}</option>)}</select>
        </label>
        <button class="btn btn--sm">Send invite</button>
      </form>
      <p class="muted">{ROLES.map((r) => <span><b>{r}</b>: {ROLE_HELP[r]}. </span>)}</p>
    </section>
  );
}
