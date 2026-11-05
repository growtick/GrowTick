import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from 'astro:env/server';

let client: SupabaseClient | null | undefined;

/** Service-role client for server routes only. Null when not configured (local dev). */
export function serviceDb(): SupabaseClient | null {
  if (client !== undefined) return client;
  client = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  return client;
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });

/** Reject cross-site POSTs: Origin (or Referer) must match this site. */
export function sameOrigin(request: Request): boolean {
  const self = new URL(request.url).origin;
  const origin = request.headers.get('origin') ?? (request.headers.get('referer') ? new URL(request.headers.get('referer')!).origin : null);
  return origin === self;
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function clientIp(request: Request, fallback?: string): string {
  return request.headers.get('cf-connecting-ip') ?? fallback ?? '0.0.0.0';
}
