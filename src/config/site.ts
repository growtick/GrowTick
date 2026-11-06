/**
 * Growtick site settings — the ONE place for business details.
 *
 * Every value marked TODO(PRD-OQ#n) is a placeholder for an open question
 * in the PRD (section 07). Fill these in before launch; no other code changes
 * are needed. `npm run check:budgets` lists any placeholders still in use.
 */

export const site = {
  name: 'Growtick',
  tagline: 'Skills Today for Brighter Tomorrow',
  positioning: 'Skill Academy & 360° Corporate Solutions',
  description:
    'Practical training, digital growth, finance and automation under one roof — Tally Prime courses, websites, GST notice replies, printing and corporate gifting.',

  contactName: 'Naveen Jain',
  /** E.164 without "+" — used for tel: and wa.me links. */
  phoneE164: '919513059059',
  phoneDisplay: '+91 95130 59059',
  whatsappGreeting: "Hi Growtick, I'm interested in the following services ",
  instagramHandle: 'growtick.in',
  instagramUrl: 'https://www.instagram.com/growtick.in',

  // TODO(PRD-OQ#3): office address and city for Google Maps and local SEO.
  address: {
    street: '',
    locality: '',
    city: 'Bengaluru', // placeholder city, used in page titles for local SEO
    region: 'Karnataka',
    postalCode: '',
    country: 'IN',
  },
  /** TODO(PRD-OQ#3): set once the address is known; the map shows a placeholder until then. */
  mapEmbedUrl: '',
  /** TODO(PRD-OQ#3): Google Business Profile link. */
  googleBusinessUrl: '',
  hours: 'Mon–Sat, 10:00 am – 7:00 pm', // TODO: confirm opening hours

  // TODO(PRD-OQ#1): is ₹400–900 monthly or yearly, and what decides the price?
  hostingFee: { from: 400, to: 900, period: 'year' as 'month' | 'year', confirmed: false },

  // TODO(PRD-OQ#2): show course fees, or keep "on request"?
  showCourseFees: false,
} as const;

export const telHref = `tel:+${site.phoneE164}`;

/** WhatsApp chat link with the pre-filled greeting from the PRD. */
export function whatsappChatHref(topic?: string): string {
  const text = topic ? `${site.whatsappGreeting} ${topic}.` : `${site.whatsappGreeting}…`;
  return `https://wa.me/${site.phoneE164}?text=${encodeURIComponent(text)}`;
}

/** wa.me share link (no number) with a page link and one-line description. */
export function whatsappShareHref(url: string, line: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${line} ${url}`)}`;
}

export function hostingFeeText(): string {
  const { from, to, period, confirmed } = site.hostingFee;
  return confirmed ? `₹${from}–${to} per ${period}` : `from ₹${from}`;
}

export const pillars = [
  { id: 'skill-academy', name: 'Skill Academy', icon: 'cap' },
  { id: 'tech-finance', name: 'Tech & Finance', icon: 'bulb' },
  { id: 'web-digital', name: 'Web & Digital', icon: 'globe' },
  { id: 'creative-b2b', name: 'Creative & B2B', icon: 'palette' },
  { id: 'trademark-ip', name: 'Trademark IP', icon: 'shield' },
] as const;

export type PillarId = (typeof pillars)[number]['id'];
