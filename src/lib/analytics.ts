/**
 * Conversion tracking for the PRD's "contact conversion" metric.
 * Cloudflare Web Analytics counts page views but has no custom events, so
 * clicks on [data-track] elements are sent with sendBeacon to /api/event,
 * which stores daily counts (no personal data) shown in the admin panel.
 */
export function track(name: string, label = '') {
  const body = JSON.stringify({ name, label, path: location.pathname });
  if (import.meta.env.DEV) console.info('[track]', name, label);
  navigator.sendBeacon?.('/api/event', new Blob([body], { type: 'application/json' }));
}

export function initTracking() {
  document.addEventListener('click', (e) => {
    const el = (e.target as Element | null)?.closest<HTMLElement>('[data-track]');
    if (el) track(el.dataset.track!, el.dataset.label ?? '');
  });
}
