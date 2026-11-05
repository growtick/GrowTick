/**
 * POST /api/lead — save an enquiry (PRD §04 contact, §06 security).
 * Order: same-origin → size → honeypot → validation → Turnstile → rate limit → save → email alert.
 * JSON clients get JSON; plain HTML form posts (no JS) get a redirect to /thanks or /form-error.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { TURNSTILE_SECRET_KEY, IP_HASH_SALT } from 'astro:env/server';
import { sanitizeLead, validateLead } from '../../lib/lead';
import { serviceDb, json, sameOrigin, sha256, clientIp } from '../../lib/server/db';
import { sendEmail, reportError } from '../../lib/server/notify';

export const prerender = false;

const MAX_BODY = 8 * 1024;

export const POST: APIRoute = async ({ request, clientAddress, redirect }) => {
  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');
  const fail = (status: number, body: Record<string, unknown>) => (wantsJson ? json(body, status) : redirect('/form-error', 303));
  const ok = () => (wantsJson ? json({ ok: true }) : redirect('/thanks', 303));

  if (!sameOrigin(request)) return fail(403, { error: 'forbidden' });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return fail(413, { error: 'too_large' });

  let raw: Record<string, unknown>;
  try {
    const type = request.headers.get('content-type') ?? '';
    raw = type.includes('application/json') ? await request.json() : Object.fromEntries((await request.formData()).entries());
    if (!raw || typeof raw !== 'object') throw new Error('bad body');
  } catch {
    return fail(400, { error: 'bad_request' });
  }

  // Honeypot filled → a bot. Pretend success, save nothing.
  if (String(raw.website ?? '').trim()) return ok();

  const services = (await getCollection('services')).map((s) => s.data.slug);
  const lead = sanitizeLead(raw);
  const errors = validateLead(lead, services);
  if (Object.keys(errors).length) return fail(400, { error: 'invalid', errors });

  const ip = clientIp(request, clientAddress);

  if (TURNSTILE_SECRET_KEY) {
    const form = new FormData();
    form.append('secret', TURNSTILE_SECRET_KEY);
    form.append('response', String(raw['cf-turnstile-response'] ?? ''));
    form.append('remoteip', ip);
    const v = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
      .then((r) => r.json() as Promise<{ success: boolean }>)
      .catch(() => ({ success: false }));
    if (!v.success) return fail(403, { error: 'captcha' });
  }

  const db = serviceDb();
  if (!db) {
    if (import.meta.env.DEV) {
      console.info('[lead] (dev, no database) would save:', lead);
      return ok();
    }
    await reportError('api/lead', new Error('Database not configured'));
    return fail(503, { error: 'unavailable' });
  }

  try {
    const ipHash = await sha256(`${IP_HASH_SALT ?? 'growtick'}:${ip}`);
    const { data: allowed, error: rlErr } = await db.rpc('check_rate_limit', { p_ip_hash: ipHash, p_limit: 5, p_window: '1 hour' });
    if (rlErr) throw rlErr;
    if (!allowed) return fail(429, { error: 'rate_limited' });

    const { data: saved, error } = await db
      .from('leads')
      .insert({
        name: lead.name, phone: lead.phone, email: lead.email ?? null, service: lead.service,
        message: lead.message ?? null, source: lead.source ?? null, consent_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) throw error;

    const serviceTitle = lead.service === 'other' ? 'Other' : (await getCollection('services')).find((s) => s.data.slug === lead.service)?.data.title ?? lead.service;
    const sent = await sendEmail(
      `New enquiry: ${serviceTitle} — ${lead.name}`,
      [
        `Name: ${lead.name}`,
        `Phone: +91 ${lead.phone}  (call: tel:+91${lead.phone} · WhatsApp: https://wa.me/91${lead.phone})`,
        `Email: ${lead.email ?? '—'}`,
        `Service: ${serviceTitle}`,
        `Message: ${lead.message ?? '—'}`,
        `Page: ${lead.source ?? '—'}`,
        '',
        'Open the admin panel to update the status.',
      ].join('\n'),
      lead.email,
    );
    if (sent) await db.from('leads').update({ email_alert_sent: true }).eq('id', saved.id);

    return ok();
  } catch (err) {
    await reportError('api/lead', err);
    return fail(500, { error: 'server' });
  }
};

export const ALL: APIRoute = () => json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
