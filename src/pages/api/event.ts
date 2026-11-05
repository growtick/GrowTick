/** POST /api/event — counts conversion clicks per day (no personal data). */
import type { APIRoute } from 'astro';
import { serviceDb, sameOrigin } from '../../lib/server/db';

export const prerender = false;
const ALLOWED = new Set(['call', 'whatsapp', 'share', 'enquire', 'instagram', 'form_submit']);

export const POST: APIRoute = async ({ request }) => {
  const done = new Response(null, { status: 204 });
  if (!sameOrigin(request)) return done;
  try {
    const body = (await request.json()) as { name?: string; label?: string; path?: string };
    if (!body?.name || !ALLOWED.has(body.name)) return done;
    await serviceDb()?.rpc('bump_event', {
      p_name: body.name,
      p_label: String(body.label ?? '').slice(0, 80),
      p_path: String(body.path ?? '').slice(0, 120),
    });
  } catch { /* metrics must never break the page */ }
  return done;
};
