/**
 * POST /api/publish — Owner/Editor triggers a site rebuild so content edits go live.
 * Preferred: GitHub Actions "deploy" workflow via repository_dispatch (GITHUB_REPO + GITHUB_DISPATCH_TOKEN),
 * so every deploy runs from the repository. Fallback: POST to any DEPLOY_HOOK_URL.
 */
import type { APIRoute } from 'astro';
import { DEPLOY_HOOK_URL, GITHUB_REPO, GITHUB_DISPATCH_TOKEN } from 'astro:env/server';
import { json, sameOrigin } from '../../lib/server/db';
import { requireAdmin, logActivity } from '../../lib/server/auth';
import { reportError } from '../../lib/server/notify';

export const prerender = false;

async function trigger(by: string): Promise<Response> {
  if (GITHUB_REPO && GITHUB_DISPATCH_TOKEN) {
    return fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_DISPATCH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'growtick-site',
      },
      body: JSON.stringify({ event_type: 'publish-content', client_payload: { by } }),
    });
  }
  return fetch(DEPLOY_HOOK_URL!, { method: 'POST' });
}

export const POST: APIRoute = async ({ request }) => {
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
  const admin = await requireAdmin(request, ['owner', 'editor']);
  if (!admin) return json({ error: 'forbidden' }, 403);
  if (!(GITHUB_REPO && GITHUB_DISPATCH_TOKEN) && !DEPLOY_HOOK_URL)
    return json({ error: 'Publishing is not configured (GITHUB_REPO + GITHUB_DISPATCH_TOKEN, or DEPLOY_HOOK_URL).' }, 501);
  try {
    const res = await trigger(admin.email);
    if (!res.ok) throw new Error(`Rebuild trigger returned ${res.status}: ${await res.text()}`);
    await logActivity(admin, 'publish', 'site');
    return json({ ok: true });
  } catch (err) {
    await reportError('api/publish', err);
    return json({ error: 'Could not start the rebuild. Try again in a minute.' }, 502);
  }
};
