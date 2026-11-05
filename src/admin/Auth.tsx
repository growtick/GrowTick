import { useEffect, useState } from 'preact/hooks';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

const LOCK_KEY = 'gt-admin-lock';
const MAX_TRIES = 5;
const LOCK_MS = 15 * 60_000;

function readLock(): { tries: number; until: number } {
  try { return JSON.parse(localStorage.getItem(LOCK_KEY) ?? '') ?? { tries: 0, until: 0 }; } catch { return { tries: 0, until: 0 }; }
}
function writeLock(v: { tries: number; until: number }) {
  try { localStorage.setItem(LOCK_KEY, JSON.stringify(v)); } catch {}
}

/** Email + password. Supabase also rate-limits sign-in attempts server-side. */
export function SignIn({ db, onDone }: { db: SupabaseClient; onDone: (s: Session) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function submit(e: Event) {
    e.preventDefault();
    const lock = readLock();
    if (lock.until > Date.now()) {
      setErr(`Too many failed attempts. Try again after ${new Date(lock.until).toLocaleTimeString()}.`);
      return;
    }
    setBusy(true); setErr('');
    const { data, error } = await db.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error || !data.session) {
      const tries = lock.tries + 1;
      writeLock(tries >= MAX_TRIES ? { tries: 0, until: Date.now() + LOCK_MS } : { tries, until: 0 });
      setErr(error?.status === 429 ? 'Too many attempts. Please wait a few minutes.' : 'Email or password is incorrect.');
      return;
    }
    writeLock({ tries: 0, until: 0 });
    onDone(data.session);
  }

  async function reset() {
    if (!email.trim()) return setErr('Enter your email first, then click “Forgot password”.');
    await db.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.href });
    setResetSent(true);
  }

  return (
    <main class="adm-auth adm">
      <h1>Growtick Admin</h1>
      <form class="adm-form" onSubmit={submit}>
        <label>Email<input type="email" autocomplete="username" required value={email} onInput={(e) => setEmail(e.currentTarget.value)} /></label>
        <label>Password<input type="password" autocomplete="current-password" required value={password} onInput={(e) => setPassword(e.currentTarget.value)} /></label>
        {err && <p class="adm-msg adm-msg--err" role="alert">{err}</p>}
        {resetSent && <p class="adm-msg adm-msg--ok" role="status">If that email has an account, a reset link is on its way.</p>}
        <button class="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <button type="button" class="btn btn--ghost btn--sm" onClick={reset}>Forgot password</button>
      </form>
    </main>
  );
}

/** Second factor (TOTP). First login enrols an authenticator app; later logins verify a code. */
export function Mfa({ db, onDone, onSignOut }: { db: SupabaseClient; onDone: () => void; onSignOut: () => void }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await db.auth.mfa.listFactors();
      const verified = data?.totp?.find((f) => f.status === 'verified');
      if (verified) return setFactorId(verified.id);
      // Clean up half-finished enrolments, then start a fresh one.
      for (const f of data?.all ?? []) if (f.status !== 'verified') await db.auth.mfa.unenroll({ factorId: f.id });
      const { data: en, error } = await db.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Growtick ${new Date().toISOString().slice(0, 10)}` });
      if (error || !en) return setErr(error?.message ?? 'Could not start 2FA setup.');
      setFactorId(en.id);
      setEnroll({ qr: en.totp.qr_code, secret: en.totp.secret });
    })();
  }, []);

  async function verify(e: Event) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true); setErr('');
    const { error } = await db.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, '') });
    setBusy(false);
    if (error) return setErr('That code didn’t work. Check your authenticator app and try again.');
    onDone();
  }

  return (
    <main class="adm-auth adm">
      <h1>Two-factor authentication</h1>
      {enroll ? (
        <>
          <p>2FA is required for every admin. Scan this QR code with Google Authenticator, Microsoft Authenticator or 1Password, then enter the 6-digit code.</p>
          <img class="qr" src={enroll.qr} alt="QR code for your authenticator app" width={200} height={200} />
          <p class="muted">Can’t scan? Enter this key manually:</p>
          <p class="adm-code">{enroll.secret}</p>
        </>
      ) : (
        <p>Enter the 6-digit code from your authenticator app.</p>
      )}
      <form class="adm-form" onSubmit={verify}>
        <label>Code<input inputMode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,7}" required value={code} onInput={(e) => setCode(e.currentTarget.value)} /></label>
        {err && <p class="adm-msg adm-msg--err" role="alert">{err}</p>}
        <button class="btn" disabled={busy || !factorId}>{busy ? 'Checking…' : 'Verify'}</button>
        <button type="button" class="btn btn--ghost btn--sm" onClick={onSignOut}>Sign out</button>
      </form>
    </main>
  );
}
