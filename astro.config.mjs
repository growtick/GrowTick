// @ts-check
import { defineConfig, envField } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import preact from '@astrojs/preact';
import { SITE_URL, ADMIN_EXCLUDE } from './src/config/build.mjs';

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'always' },
  // Public pages are prerendered; only /api/* and the admin route run on the server.
  output: 'static',
  adapter: cloudflare({ prerenderEnvironment: 'node', imageService: 'passthrough' }),
  integrations: [
    preact(),
    sitemap({ filter: (page) => !ADMIN_EXCLUDE.some((p) => page.includes(p)) }),
  ],
  prefetch: false,
  markdown: { syntaxHighlight: false },
  session: false, // not used; avoids provisioning a KV namespace
  // CSP as a <meta> tag with hashes for every inline script/style Astro emits.
  // frame-ancestors, HSTS etc. are HTTP headers in public/_headers.
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com https://cloudflareinsights.com",
        "frame-src https://challenges.cloudflare.com https://www.google.com https://maps.google.com",
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "manifest-src 'self'",
      ],
      scriptDirective: { resources: ["'self'", 'https://challenges.cloudflare.com', 'https://static.cloudflareinsights.com'] },
      styleDirective: { resources: ["'self'"] },
    },
  },
  env: {
    schema: {
      // Public (safe in browser)
      PUBLIC_SUPABASE_URL: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_SUPABASE_ANON_KEY: envField.string({ context: 'client', access: 'public', optional: true }),
      // Public widget site key; override per environment if needed.
      PUBLIC_TURNSTILE_SITE_KEY: envField.string({ context: 'client', access: 'public', optional: true, default: '0x4AAAAAAF1oJauByyrcQjqK' }),
      PUBLIC_CF_ANALYTICS_TOKEN: envField.string({ context: 'client', access: 'public', optional: true }),
      // Server secrets (never shipped to the browser)
      SUPABASE_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      TURNSTILE_SECRET_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Comma-separated hostnames a Turnstile token may come from (e.g. "www.growtick.in,growtick.in").
      TURNSTILE_HOSTNAMES: envField.string({ context: 'server', access: 'secret', optional: true }),
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      ALERT_EMAIL_TO: envField.string({ context: 'server', access: 'secret', optional: true }),
      ALERT_EMAIL_FROM: envField.string({ context: 'server', access: 'secret', optional: true }),
      DEPLOY_HOOK_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      GITHUB_REPO: envField.string({ context: 'server', access: 'secret', optional: true }),
      GITHUB_DISPATCH_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
      ADMIN_PATH: envField.string({ context: 'server', access: 'secret', optional: true }),
      IP_HASH_SALT: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
