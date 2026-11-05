# Growtick website

Mobile-first website for **Growtick — Skill Academy & 360° Corporate Solutions**, built from
`Growtick_Website_PRD.pdf` (v1.0). Very light 3-section home page, 19 service pages, lead capture
(form, call, WhatsApp), and an admin panel with roles and 2FA.

| Piece | Tech |
|---|---|
| Site | [Astro 7](https://astro.build) — static pages, ~4 KB JS on the home page |
| Hosting, CDN, WAF, CAPTCHA | Cloudflare Workers (static assets + 4 small server routes), Turnstile |
| Database + admin login (2FA) | Supabase (Postgres, Auth with TOTP) |
| Lead alert emails | Resend |
| Analytics | Cloudflare Web Analytics (page views) + own click counters in Supabase (conversions) |
| Content backup | Markdown in `content/`, weekly export via GitHub Actions |

Measured locally (Lighthouse, mobile): **100 / 100 / 100 / 100** on the home page and inner pages;
home page 31 KB transferred, 4 KB JS, 5 requests (PRD budget: 500 KB / 50 KB / 15).

---

## Run it locally

```bash
npm install
npm run dev            # http://localhost:4321 — content comes from content/*.md
```

No accounts are needed for local work. Without Supabase, the form validates but does not save
(in `npm run dev` it logs the lead to the terminal), and the admin panel shows "not configured".

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the build in the real Cloudflare runtime (copy `.dev.vars` into `dist/server/` first) |
| `npm run check` | TypeScript / Astro check |
| `npm run check:budgets` | PRD budgets, 19 service pages, 3 home sections, SEO tags, CSP, `noopener` links |
| `npm run check:budgets -- --strict` | Also fails on launch blockers (placeholders, sample reviews, < 3 testimonials) |
| `npm run seed` | Load `content/*.md` into Supabase (first setup / disaster recovery) |
| `npm run export:md` | Export Supabase content back into `content/*.md` |
| `node scripts/build-favicons.mjs` | Re-generate favicons + share image after replacing the logo |
| `node scripts/build-icons.mjs` | Re-generate the icon sprite |

## Where things live

```
src/config/site.ts        ← business details & every PRD open-question placeholder (one file)
content/                  ← services, FAQs, testimonials, About page (Markdown; also the backup)
src/pages/                ← public pages; services/[slug].astro is the 19-page template
src/pages/api/            ← lead.ts (form), event.ts (click counts), publish.ts, admin/users.ts
src/pages/[admin].astro   ← admin panel at /<ADMIN_PATH>; UI in src/admin/
src/components/           ← Carousel (home + testimonials), ContactForm, Logo (animated), …
supabase/migrations/      ← database schema, row-level security, activity log triggers
public/_headers           ← HSTS, X-Frame-Options, Referrer-Policy, … (CSP is a per-page meta tag)
```

**Placeholders to fill in before launch** (all marked `TODO(PRD-OQ#n)`):
`src/config/site.ts` (address & city, map, Google Business link, hosting-fee period, course fees),
`src/config/build.mjs` + `wrangler.jsonc` (domain), FAQ answers in `content/faqs/`, the About page,
course durations/batches in `src/pages/academy.astro`, and the privacy notice review.
`npm run check:budgets -- --strict` lists everything still open.

**Brand assets are placeholders**: the logo/“G” mark (`src/components/Logo.astro`, `public/favicon.svg`,
`scripts/build-favicons.mjs`) and the hero illustration (`src/components/HeroArt.astro`). Swap in the real
SVGs, keep the same width/height, then run `node scripts/build-favicons.mjs`. Colours in
`src/styles/global.css` are the PRD's approximate values — confirm against the brochure files.

---

## Production setup (one time)

> **Ownership rule (PRD "no master"):** create every account below with a **Growtick company email**,
> add **at least 2 owner-level admins** on each, and keep credentials in a **shared password manager**
> (not with the developer).

### 1. GitHub
1. Create a **private** repo under a Growtick organisation; push this folder.
2. Settings → Branches → protect `main`: require a pull request and the **CI** check to pass; no force pushes.
3. Settings → Environments → create `production`.
4. Add secrets/variables (Settings → Secrets and variables → Actions):
   - Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
   - Variables: `SITE_URL`, `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_TURNSTILE_SITE_KEY`, `PUBLIC_CF_ANALYTICS_TOKEN`
5. Create a fine-grained token limited to this repo with **Contents: read & write** (used by the admin
   "Publish changes" button). Prefer a Growtick bot/machine account so it isn't tied to one person.

### 2. Supabase
1. New project (region: Mumbai `ap-south-1`).
2. Apply the schema: `npx supabase init` (keep the existing `migrations/`), `npx supabase link --project-ref <ref>`, `npx supabase db push`.
3. Authentication → Providers → Email: disable public sign-ups (admins are invited only).
   Authentication → Multi-Factor: enable **TOTP**.
4. Load content: `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run seed`
5. First owner: Authentication → Users → **Invite** your email, accept, then in the SQL editor:
   `update profiles set role = 'owner' where email = 'you@growtick.in';`
   Sign in to the admin panel (sets up 2FA), then invite the **second owner** from Admin → Users.
6. **Backups:** daily backups with 7-day retention come with the Pro plan; the PRD's **30 days** needs the
   Pro plan + Point-in-Time Recovery add-on (or the weekly Markdown export as the long-term copy).

### 3. Cloudflare
1. Add the domain; at the registrar turn on **transfer lock** and **auto-renew**.
2. Turnstile → add widget (mode: *Invisible* or *Managed*) → site key + secret.
3. Web Analytics → add site → token.
4. Create an API token with **Workers Scripts: Edit** (for GitHub Actions).
5. After the first deploy: Workers → growtick-site → Settings → Domains → add `www.growtick.in` (and redirect apex).
6. Worker secrets (`npx wrangler secret put NAME` or dashboard → Settings → Variables):
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `ALERT_EMAIL_TO`,
   `ALERT_EMAIL_FROM`, `ADMIN_PATH` (long random, e.g. `gt-console-8k2fq7x`), `IP_HASH_SALT` (random),
   `GITHUB_REPO`, `GITHUB_DISPATCH_TOKEN`.
7. Security → WAF: enable the free managed ruleset; add a rate-limit rule for `/api/*` as a second layer.
   SSL/TLS → **Full (strict)**, Always Use HTTPS, HSTS.

### 4. Resend
Add and verify the sending domain (DNS records in Cloudflare), create an API key, set `ALERT_EMAIL_FROM`
to an address on that domain.

### 5. Uptime monitoring
UptimeRobot (free) or Better Stack: monitor `https://www.growtick.in/` and alert the owners' emails.

## How deploys work

- **Code changes** → pull request → CI (type check, build, budgets, Lighthouse) → merge to `main` → **Deploy** workflow builds and deploys. No direct edits on the live server.
- **Content changes** → Admin panel → edit → **Publish changes** → starts the Deploy workflow (1–2 minutes). The build reads content from Supabase.
- **Backup** → every Monday the **Content backup** workflow exports the database to `content/*.md` and opens a PR. Merge it.
- **Disaster recovery** → new Supabase project → `db push` → `npm run seed` (from the Markdown) → redeploy.

## Admin panel

`https://<domain>/<ADMIN_PATH>` — email + password, then a 6-digit code from an authenticator app (required for everyone).

| Role | Can do |
|---|---|
| Owner | Everything, including inviting/removing users and deleting leads |
| Editor | Edit services, FAQs, testimonials; read leads and change their status; publish |
| Viewer | Read leads only |

Leads: filter by service/date/status, update status, export CSV. Insights: call/WhatsApp/form counts for 30 days.
Activity log: who changed what (database triggers record every change).

## Decisions made with Growtick

Stack Astro + Supabase + Cloudflare · content updates rebuild static pages · Cloudflare Web Analytics ·
Resend email alerts (no WhatsApp/SMS alerts in v1) · sample testimonials only in dev/preview builds
(`SHOW_SAMPLES=1`) · Space Grotesk for headings + system font for body · Editors can read leads and change
status; only Owners delete leads.
