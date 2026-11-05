import { useEffect, useMemo, useState } from 'preact/hooks';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { SignIn, Mfa } from './Auth';
import { Leads } from './Leads';
import { ContentEditor, CONTENT } from './ContentEditor';
import { Users } from './Users';
import { Activity } from './Activity';
import { Insights } from './Insights';
import type { Ctx, Profile, ServiceRef } from './types';

interface Props { supabaseUrl: string; anonKey: string; services: ServiceRef[] }

type Stage = 'loading' | 'signin' | 'mfa' | 'ready' | 'noprofile';
type Tab = 'leads' | 'insights' | 'testimonials' | 'faqs' | 'services' | 'users' | 'activity';

export default function AdminApp({ supabaseUrl, anonKey, services }: Props) {
  const db: SupabaseClient = useMemo(() => createClient(supabaseUrl, anonKey, { auth: { persistSession: true, storageKey: 'gt-admin' } }), []);
  const [stage, setStage] = useState<Stage>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<Tab>('leads');
  const [publishMsg, setPublishMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function evaluate(s: Session | null) {
    setSession(s);
    if (!s) return setStage('signin');
    const { data: aal } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== 'aal2') return setStage('mfa');
    const { data: p } = await db.from('profiles').select('id, email, full_name, role').eq('id', s.user.id).single();
    if (!p) return setStage('noprofile');
    setProfile(p as Profile);
    setStage('ready');
  }

  useEffect(() => {
    db.auth.getSession().then(({ data }) => evaluate(data.session));
    const { data: sub } = db.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT') evaluate(null);
      if (event === 'MFA_CHALLENGE_VERIFIED' || event === 'TOKEN_REFRESHED') setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (stage === 'loading') return <main class="adm-center adm"><p>Loading…</p></main>;
  if (stage === 'signin') return <SignIn db={db} onDone={(s) => evaluate(s)} />;
  if (stage === 'mfa') return <Mfa db={db} onDone={async () => evaluate((await db.auth.getSession()).data.session)} onSignOut={() => db.auth.signOut()} />;
  if (stage === 'noprofile' || !profile || !session)
    return <main class="adm-auth adm"><h1>No access</h1><p>Your login has no admin role yet. Ask an owner to add you.</p><button class="btn" onClick={() => db.auth.signOut()}>Sign out</button></main>;

  const ctx: Ctx = { db, profile, services, token: () => db.auth.getSession().then((r) => r.data.session?.access_token ?? '') };
  const canEdit = profile.role === 'owner' || profile.role === 'editor';
  const tabs: [Tab, string, boolean][] = [
    ['leads', 'Leads', true],
    ['insights', 'Insights', true],
    ['testimonials', 'Testimonials', canEdit],
    ['faqs', 'FAQs', canEdit],
    ['services', 'Services', canEdit],
    ['users', 'Users', profile.role === 'owner'],
    ['activity', 'Activity log', canEdit],
  ];

  async function publish() {
    if (!confirm('Publish content changes to the live site now? The rebuild takes 1–2 minutes.')) return;
    setPublishMsg({ ok: true, text: 'Starting rebuild…' });
    const res = await fetch('/api/publish', { method: 'POST', headers: { Authorization: `Bearer ${await ctx.token()}` } });
    const body = await res.json().catch(() => ({}));
    setPublishMsg(res.ok ? { ok: true, text: 'Rebuild started. Changes will be live in 1–2 minutes.' } : { ok: false, text: body.error ?? `Publish failed (${res.status}).` });
  }

  return (
    <div class="adm">
      <header class="adm-top">
        <div class="wrap adm-top__in">
          <span class="adm-top__brand">Growtick Admin</span>
          <span class="muted">{profile.email} · <span class="adm-badge">{profile.role}</span></span>
          {canEdit && <button class="btn btn--sm" onClick={publish}>Publish changes</button>}
          <button class="btn btn--sm btn--ghost" onClick={() => db.auth.signOut()}>Sign out</button>
        </div>
        <nav class="wrap adm-tabs" aria-label="Admin sections">
          {tabs.filter((t) => t[2]).map(([id, label]) => (
            <button aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>
      </header>
      <main class="wrap adm-main">
        {publishMsg && <p class={`adm-msg ${publishMsg.ok ? 'adm-msg--ok' : 'adm-msg--err'}`} role="status">{publishMsg.text}</p>}
        {tab === 'leads' && <Leads ctx={ctx} />}
        {tab === 'insights' && <Insights ctx={ctx} />}
        {tab === 'testimonials' && <ContentEditor ctx={ctx} config={CONTENT.testimonials} />}
        {tab === 'faqs' && <ContentEditor ctx={ctx} config={CONTENT.faqs} />}
        {tab === 'services' && <ContentEditor ctx={ctx} config={CONTENT.services} />}
        {tab === 'users' && <Users ctx={ctx} />}
        {tab === 'activity' && <Activity ctx={ctx} />}
      </main>
    </div>
  );
}
