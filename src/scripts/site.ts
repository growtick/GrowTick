import { initTracking } from '../lib/analytics';

/** Site-wide behaviour: theme toggle, mobile menu, WhatsApp button, analytics. */
export function initSite() {
  const root = document.documentElement;

  // Dark mode toggle — choice remembered on this device.
  const themeBtn = document.getElementById('theme-toggle');
  const syncTheme = () => {
    const dark = root.dataset.theme === 'dark';
    themeBtn?.setAttribute('aria-pressed', String(dark));
  };
  syncTheme();
  themeBtn?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch {}
    syncTheme();
  });
  // Follow device changes until the visitor picks a theme.
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    let saved: string | null = null;
    try { saved = localStorage.getItem('theme'); } catch {}
    if (!saved) { root.dataset.theme = e.matches ? 'dark' : 'light'; syncTheme(); }
  });

  // Mobile menu
  const menuBtn = document.getElementById('menu-toggle');
  const setMenu = (open: boolean) => {
    root.classList.toggle('nav-open', open);
    menuBtn?.setAttribute('aria-expanded', String(open));
  };
  menuBtn?.addEventListener('click', () => setMenu(!root.classList.contains('nav-open')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('nav-open')) { setMenu(false); menuBtn?.focus(); } });
  document.querySelectorAll('#site-nav a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.querySelectorAll<HTMLButtonElement>('.nav__subtoggle').forEach((b) =>
    b.addEventListener('click', () => b.setAttribute('aria-expanded', String(b.getAttribute('aria-expanded') !== 'true'))),
  );

  // Hide the floating WhatsApp button while a [data-hide-fab] section is on screen.
  const hideZone = document.querySelector('[data-hide-fab]');
  if (hideZone && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => root.classList.toggle('fab-hidden', e.isIntersecting), { threshold: 0.15 }).observe(hideZone);
  }

  initTracking();

  // Cloudflare Web Analytics: loaded only after the page is interactive and idle.
  const token = document.getElementById('cf-analytics')?.dataset.token;
  if (token) {
    const load = () => {
      const s = document.createElement('script');
      s.defer = true;
      s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
      s.dataset.cfBeacon = JSON.stringify({ token });
      document.body.appendChild(s);
    };
    const idle = (window as any).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500));
    if (document.readyState === 'complete') idle(load);
    else addEventListener('load', () => idle(load), { once: true });
  }
}
