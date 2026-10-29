// Renders every Android launcher icon from assets/icon-source.svg.
// Run with `npm run icons` after editing the SVG, then rebuild the app.
//
//   mipmap-*/ic_launcher.png            legacy icon (Android 7.x); the design is already round
//   mipmap-*/ic_launcher_foreground.png adaptive foreground (Android 8+)
//   mipmap-*/ic_launcher_monochrome.png themed icon (Android 13+)
//
// The adaptive background is the solid colour in values/ic_launcher_background.xml.

import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const res = new URL('android/app/src/main/res/', root);
const source = await readFile(new URL('assets/icon-source.svg', root), 'utf8');

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const SOURCE_SIZE = 512;
const SOURCE_CENTER = SOURCE_SIZE / 2;
/** Distance from the centre to the compass tips in source units (88 × 2.1333). */
const MARK_RADIUS = 187.7;

// Adaptive icons are 108dp square; launchers mask them to the central 72dp and
// only a 66dp circle is guaranteed visible, so keep the tips inside r = 31dp.
const ADAPTIVE_SIZE = 108;
const scale = 31 / MARK_RADIUS;

const content = source.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const mark = content.match(/<g id="mark"[\s\S]*<\/g>/)?.[0];
if (!mark) throw new Error('assets/icon-source.svg must contain a <g id="mark"> group');

const monochromeMark = mark
  .replace(/<circle data-hub[^>]*\/>/g, '')
  .replace(/fill="#[0-9a-fA-F]{3,8}"/g, 'fill="#ffffff"');

const adaptive = (body, px) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${ADAPTIVE_SIZE} ${ADAPTIVE_SIZE}">` +
  `<g transform="translate(${ADAPTIVE_SIZE / 2} ${ADAPTIVE_SIZE / 2}) scale(${scale}) translate(${-SOURCE_CENTER} ${-SOURCE_CENTER})">${body}</g></svg>`;

const sized = (px) => source.replace(/width="\d+" height="\d+"/, `width="${px}" height="${px}"`);

const render = (svg, file) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(fileURLToPath(file));

for (const [name, density] of Object.entries(DENSITIES)) {
  const dir = new URL(`mipmap-${name}/`, res);
  await mkdir(dir, { recursive: true });

  const legacyPx = Math.round(48 * density);
  const adaptivePx = Math.round(ADAPTIVE_SIZE * density);

  await render(sized(legacyPx), new URL('ic_launcher.png', dir));
  await render(adaptive(content, adaptivePx), new URL('ic_launcher_foreground.png', dir));
  await render(adaptive(monochromeMark, adaptivePx), new URL('ic_launcher_monochrome.png', dir));
  console.log(`mipmap-${name}: ${legacyPx}px legacy, ${adaptivePx}px adaptive`);
}
