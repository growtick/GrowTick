import { RESEND_API_KEY, ALERT_EMAIL_TO, ALERT_EMAIL_FROM } from 'astro:env/server';

const recipients = () => (ALERT_EMAIL_TO ?? '').split(',').map((s) => s.trim()).filter(Boolean);

/** Send a plain-text email through Resend. Returns false if not configured or failed. */
export async function sendEmail(subject: string, text: string, replyTo?: string): Promise<boolean> {
  const to = recipients();
  if (!RESEND_API_KEY || !ALERT_EMAIL_FROM || !to.length) {
    console.warn('[notify] email not configured; skipped:', subject);
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: ALERT_EMAIL_FROM, to, subject, text, ...(replyTo && { reply_to: replyTo }) }),
    });
    if (!res.ok) console.error('[notify] resend error', res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error('[notify] resend failed', err);
    return false;
  }
}

// Server errors are emailed to the owner, at most once per 10 minutes per worker instance.
let lastErrorMail = 0;
export async function reportError(where: string, err: unknown): Promise<void> {
  console.error(`[error] ${where}`, err);
  if (Date.now() - lastErrorMail < 10 * 60_000) return;
  lastErrorMail = Date.now();
  await sendEmail(`[Growtick site] Server error in ${where}`, `${new Date().toISOString()}\n\n${err instanceof Error ? err.stack ?? err.message : String(err)}`);
}
