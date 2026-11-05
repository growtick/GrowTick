/**
 * Owner-only user management that needs the Supabase admin API:
 *   POST   { email, role }  → invite a new admin (email invite link)
 *   DELETE { id }           → remove an admin's login entirely
 * Changing an existing user's role is done directly from the admin UI (RLS allows owners).
 */
import type { APIRoute } from 'astro';
import { json, sameOrigin, serviceDb } from '../../../lib/server/db';
import { requireAdmin, logActivity, type Role } from '../../../lib/server/auth';

export const prerender = false;
const ROLES: Role[] = ['owner', 'editor', 'viewer'];

export const POST: APIRoute = async ({ request }) => {
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
  const owner = await requireAdmin(request, ['owner']);
  if (!owner) return json({ error: 'forbidden' }, 403);
  const { email, role } = (await request.json().catch(() => ({}))) as { email?: string; role?: Role };
  const cleanEmail = String(email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail) || !ROLES.includes(role as Role)) return json({ error: 'Enter a valid email and role.' }, 400);

  const db = serviceDb()!;
  const redirectTo = new URL(request.url).origin + new URL(request.headers.get('referer') ?? request.url).pathname;
  const { data, error } = await db.auth.admin.inviteUserByEmail(cleanEmail, { redirectTo });
  if (error) return json({ error: error.message }, 400);
  await db.from('profiles').upsert({ id: data.user.id, email: cleanEmail, role });
  await logActivity(owner, 'invite', 'profiles', data.user.id, { email: cleanEmail, role });
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ request }) => {
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
  const owner = await requireAdmin(request, ['owner']);
  if (!owner) return json({ error: 'forbidden' }, 403);
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id || id === owner.id) return json({ error: 'You cannot remove yourself.' }, 400);

  const db = serviceDb()!;
  // Never leave the site without at least two owners if the target is an owner.
  const { data: target } = await db.from('profiles').select('role, email').eq('id', id).single();
  if (target?.role === 'owner') {
    const { count } = await db.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'owner');
    if ((count ?? 0) <= 2) return json({ error: 'The PRD requires at least 2 owners. Add another owner first.' }, 400);
  }
  const { error } = await db.auth.admin.deleteUser(id);
  if (error) return json({ error: error.message }, 400);
  await logActivity(owner, 'remove_user', 'profiles', id, { email: target?.email });
  return json({ ok: true });
};
