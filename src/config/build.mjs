// Build-time constants shared by astro.config.mjs and scripts.
// TODO(PRD-OQ#4): replace with the final registered domain.
export const SITE_URL = process.env.SITE_URL || 'https://www.growtick.in';
// Sitemap must never list the admin or API routes.
export const ADMIN_EXCLUDE = ['/api/', '/thanks', '/form-error', '/404'];
