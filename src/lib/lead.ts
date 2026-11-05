/**
 * Lead validation shared by the browser (instant inline errors) and the
 * /api/lead endpoint (the authority). Plain TS, no dependencies, so it adds
 * almost nothing to the page weight.
 */
export interface LeadInput {
  name: string;
  phone: string;
  email?: string;
  service: string;
  message?: string;
  consent: boolean;
  source?: string;
}
export type LeadErrors = Partial<Record<keyof LeadInput, string>>;

export const MESSAGE_MAX = 500;

/** Accepts "+91 95130 59059", "09513059059", "9513-059-059" → "9513059059". */
export function normalizePhone(raw: string): string {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

const clean = (s: unknown, max: number) =>
  String(s ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);

export function sanitizeLead(raw: Record<string, unknown>): LeadInput {
  return {
    name: clean(raw.name, 80).replace(/\s+/g, ' '),
    phone: normalizePhone(clean(raw.phone, 20)),
    email: clean(raw.email, 120).toLowerCase() || undefined,
    service: clean(raw.service, 60),
    message: clean(raw.message, MESSAGE_MAX + 50) || undefined,
    consent: raw.consent === true || raw.consent === 'on' || raw.consent === 'true',
    source: clean(raw.source, 120) || undefined,
  };
}

export function validateLead(l: LeadInput, validServices: readonly string[]): LeadErrors {
  const e: LeadErrors = {};
  if (l.name.length < 2) e.name = 'Please enter your name.';
  if (!l.phone) e.phone = 'Please enter your mobile number.';
  else if (!/^[6-9]\d{9}$/.test(l.phone)) e.phone = 'Please enter a 10-digit Indian mobile number, e.g. 98765 43210.';
  if (l.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(l.email)) e.email = 'That email address doesn’t look right — or leave it blank.';
  if (!l.service) e.service = 'Please choose the service you’re interested in.';
  else if (l.service !== 'other' && !validServices.includes(l.service)) e.service = 'Please choose a service from the list.';
  if (l.message && l.message.length > MESSAGE_MAX) e.message = `Please keep your message under ${MESSAGE_MAX} characters.`;
  if (!l.consent) e.consent = 'Please agree so we can contact you about your enquiry.';
  return e;
}
