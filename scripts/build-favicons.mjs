// Rasterises the placeholder "G" mark into PNG favicons, the manifest icon and the
// default social share image. Re-run after replacing the logo: node scripts/build-favicons.mjs
import sharp from 'sharp';

const mark = (bg = '#ffffff', pad = 0) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${48 + pad * 2} ${48 + pad * 2}"><rect x="${-pad}" y="${-pad}" width="${48 + pad * 2}" height="${48 + pad * 2}" fill="${bg}"/><path d="M37.5 15.5A16 16 0 1 0 40 26H27" fill="none" stroke="#16a34a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 24.5l5 5 8.5-9.5" fill="none" stroke="#db2777" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`);

await sharp(mark()).resize(16, 16).png().toFile('public/favicon-16.png');
await sharp(mark()).resize(32, 32).png().toFile('public/favicon-32.png');
await sharp(mark('#ffffff', 6)).resize(180, 180).png().toFile('public/apple-touch-icon.png');
await sharp(mark('#ffffff', 10)).resize(512, 512).png().toFile('public/icon-512.png');

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#042e1a"/>
<g transform="translate(100 215) scale(3.2)"><path d="M37.5 15.5A16 16 0 1 0 40 26H27" fill="none" stroke="#4ade80" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 24.5l5 5 8.5-9.5" fill="none" stroke="#f472b6" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></g>
<text x="300" y="285" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="96" fill="#ffffff">GROWTICK</text>
<text x="302" y="345" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#4ade80">Skill Academy &amp; 360° Corporate Solutions</text>
<rect x="302" y="385" width="72" height="6" rx="3" fill="#db2777"/>
<text x="302" y="450" font-family="Arial, Helvetica, sans-serif" font-size="26" letter-spacing="6" fill="#f59e0b">SKILLS TODAY FOR BRIGHTER TOMORROW</text>
</svg>`;
await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile('public/og-default.png');
console.log('favicons + og image written');
