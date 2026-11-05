import { serviceDb } from './db';

export type Role = 'owner' | 'editor' | 'viewer';
export interface Admin { id: string; email: string; role: Role }

/**
 * Verifies the caller's Supabase access token (Authorization: Bearer …),
 * requires 2FA (aal2) and one of the given roles. Returns null if not allowed.
 */
export async function requireAdmin(request: Request, roles: Role[]): Promise<Admin | null> {
  const db = serviceDb();
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!db || !token) return null;

  const { data, error } = await db.auth.getUser(token); // validates signature + expiry with Supabase
  if (error || !data.user) return null;

  // Token is verified above; read the assurance level claim from its payload.
  let aal = '';
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    aal = JSON.parse(atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='))).aal ?? '';
  } catch { return null; }
  if (aal !== 'aal2') return null;

  const { data: profile } = await db.from('profiles').select('role, email').eq('id', data.user.id).single();
  if (!profile || !roles.includes(profile.role)) return null;
  return { id: data.user.id, email: profile.email, role: profile.role };
}

export async function logActivity(admin: Admin, action: string, table: string, rowId?: string, after?: unknown) {
  await serviceDb()?.from('activity_log').insert({
    actor: admin.id, actor_email: admin.email, action, table_name: table, row_id: rowId ?? null, after: after ?? null,
  });
}
