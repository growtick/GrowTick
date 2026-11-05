# Pre-launch checklist (PRD §07)

Status key: ✅ built and tested in code · 🔧 needs accounts/setup (see README) · 📝 needs Growtick content/decision

| # | Item | Status | How to verify |
|---|---|---|---|
| 1 | Access control: admin roles and 2FA working | ✅ code · 🔧 | RLS requires `aal2` on every admin policy. After Supabase setup: sign in, enrol TOTP, test each role |
| 2 | Logo animation plays once, under 50 KB | ✅ (placeholder logo, <2 KB) · 📝 real logo | CSS-only, ~1.1 s, fixed size (CLS 0) |
| 3 | PageSpeed 90+ on all pages, 95+ on home (mobile) | ✅ locally 100/100/100/100 | Re-run PageSpeed Insights on the live URL |
| 4 | Security: HTTPS, WAF, headers, form rate limit | ✅ headers, CSP, honeypot, Turnstile, 5/IP/hour · 🔧 WAF/HTTPS in Cloudflare | securityheaders.com on the live URL |
| 5 | SEO: meta tags, schema, sitemap, Search Console | ✅ tags/schema/sitemap · 🔧 Search Console | Submit `/sitemap-index.xml` in Search Console |
| 6 | Error handling: 404, form failure fallback, uptime alerts | ✅ 404 + fallback · 🔧 uptime monitor | Stop the DB → form shows Call/WhatsApp + Retry |
| 7 | Database: leads saving, daily backups | ✅ code · 🔧 Supabase plan for 30-day backups | Submit a real enquiry; check Admin → Leads + email |
| 8 | Dark mode checked on every page | ✅ | Toggle in header; follows device on first visit |
| 9 | Corporate Memphis illustrations licensed and in place | 📝 | Replace `src/components/HeroArt.astro` |
| 10 | Links: Google Business, Instagram, directories updated | 📝 🔧 | Add the site link on GBP, Instagram bio, WhatsApp Business, Justdial/IndiaMART/Sulekha (same name/phone/address) |
| 11 | No master account: 2 owner admins on every service | 🔧 | Admin → Users warns if fewer than 2 owners; repeat for GitHub, Cloudflare, Supabase, Resend, registrar |
| 12 | Locked: domain transfer lock, protected main branch | 🔧 | Registrar + GitHub branch protection |
| 13 | MD file backup in Git repository | ✅ | `content/` + weekly **Content backup** workflow |
| 14 | Testimonials page live with at least 3 real entries | 📝 | Add in Admin → Testimonials (tick consent), Publish |
| 15 | FAQ page live | ✅ page · 📝 answers | Fill answers in Admin → FAQs |
| 16 | Favicon on all browsers and phone home screen | ✅ (placeholder "G") · 📝 real mark | 16/32/180/512 + SVG + manifest |
| 17 | Share to WhatsApp and WhatsApp chat buttons tested | ✅ | Floating button, footer share, service-page share |
| 18 | Home page only hero + carousel + contact, < 500 KB; carousel loops, swipes, pauses | ✅ 31 KB | `npm run check:budgets` enforces 3 sections and budgets |

## Open questions from the PRD (fill in `src/config/site.ts`)

1. Is ₹400–900 monthly or yearly, and what decides the price? → `hostingFee`
2. Show course fees or "on request"? → `showCourseFees` + `src/pages/academy.astro`
3. Office address and city → `address`, `mapEmbedUrl`, `googleBusinessUrl` (city is a placeholder "Bengaluru")
4. Domain name → `src/config/build.mjs`, `wrangler.jsonc`, GitHub variable `SITE_URL`
5. Alert email (and WhatsApp?) → `ALERT_EMAIL_TO` secret; WhatsApp alerts are out of v1
6. "No master" / "locked" — implemented as the PRD assumes
7. Testimonials and photos with written consent → Admin → Testimonials

Final gate: `npm run build && npm run check:budgets -- --strict` must pass.
