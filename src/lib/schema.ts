/** schema.org JSON-LD builders (PRD §06 SEO). */
import { site } from '../config/site';

export function localBusiness(base: URL) {
  const a = site.address;
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: site.name,
    url: base.href,
    image: new URL('/og-default.png', base).href,
    telephone: `+${site.phoneE164}`,
    slogan: site.tagline,
    description: site.description,
    address: {
      '@type': 'PostalAddress',
      ...(a.street ? { streetAddress: a.street } : {}),
      ...(a.postalCode ? { postalCode: a.postalCode } : {}),
      addressLocality: a.city,
      addressRegion: a.region,
      addressCountry: a.country,
    },
    areaServed: a.city,
    sameAs: [site.instagramUrl, site.googleBusinessUrl].filter(Boolean),
  };
}

export function serviceSchema(base: URL, s: { title: string; description: string; slug: string; pillar: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: s.title,
    serviceType: s.pillar,
    description: s.description,
    url: new URL(`/services/${s.slug}`, base).href,
    areaServed: site.address.city,
    provider: { '@type': 'ProfessionalService', name: site.name, telephone: `+${site.phoneE164}`, url: base.href },
  };
}

export function faqPage(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
  };
}

export function breadcrumbs(base: URL, trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, item: new URL(t.path, base).href })),
  };
}
