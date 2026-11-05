import type { SupabaseClient } from '@supabase/supabase-js';

export type Role = 'owner' | 'editor' | 'viewer';
export interface Profile { id: string; email: string; full_name: string | null; role: Role }
export interface ServiceRef { slug: string; title: string; number: number }
export interface Ctx {
  db: SupabaseClient;
  profile: Profile;
  services: ServiceRef[];
  token: () => Promise<string>;
}

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
