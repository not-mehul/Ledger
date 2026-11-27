// Renders every Android launcher icon from assets/icon-source.svg.
// Run with `npm run icons` after editing the SVG, then rebuild the app.
//
//   mipmap-*/ic_launcher.png            the whole tile (launchers that ignore adaptive icons)
//   mipmap-*/ic_launcher_foreground.png adaptive foreground: #mark alone (Android 8+), also
//                                       the Android 12+ splash icon
//   mipmap-*/ic_launcher_monochrome.png themed icon: #mark in white (Android 13+)
//
// The adaptive background is drawable/ic_launcher_background.xml, the same
// gradient as #backdrop. public/favicon.svg is a copy of the source.

import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const res = new URL('android/app/src/main/res/', root);
const sourceFile = new URL('assets/icon-source.svg', root);
const source = await readFile(sourceFile, 'utf8');

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
// The source is drawn on the 108-unit adaptive-icon grid. Launchers mask the
// foreground to its central 72dp, and only a 66dp circle is sure to show, so
// the dial (outer radius 26.8) is scaled well inside that, to about 48dp across.
const GRID = 108;
const ADAPTIVE_SCALE = 0.9;
const ADAPTIVE_DROP = 2.5; // the dial is open at the bottom: sit it a little low

const mark = source.match(/<g id="mark">[\s\S]*?<\/g>/)?.[0];
if (!mark) throw new Error('assets/icon-source.svg must contain a <g id="mark"> group');

// Themed icons are one colour, drawn from alpha: the track goes faint and the
// gold end dot, which would merge into the arc, is dropped.
const monochromeMark = mark
  .replace(/<circle[^>]*data-dot[^>]*\/>/, '')
  .replace(/<path[^>]*data-track[^>]*\/>/, (track) => track.replace('/>', ' stroke-opacity="0.35"/>'))
  .replace(/(fill|stroke)="#[0-9a-fA-F]{3,8}"/g, '$1="#ffffff"');

const adaptive = (body, px) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${GRID} ${GRID}">` +
  `<g transform="translate(54 ${54 + ADAPTIVE_DROP}) scale(${ADAPTIVE_SCALE}) translate(-54 -54)">${body}</g></svg>`;

const sized = (px) => source.replace(/width="\d+" height="\d+"/, `width="${px}" height="${px}"`);

const render = (svg, file) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(fileURLToPath(file));

for (const [name, density] of Object.entries(DENSITIES)) {
  const dir = new URL(`mipmap-${name}/`, res);
  await mkdir(dir, { recursive: true });

  const legacyPx = Math.round(48 * density);
  const adaptivePx = Math.round(GRID * density);

  await render(sized(legacyPx), new URL('ic_launcher.png', dir));
  await render(adaptive(mark, adaptivePx), new URL('ic_launcher_foreground.png', dir));
  await render(adaptive(monochromeMark, adaptivePx), new URL('ic_launcher_monochrome.png', dir));
  console.log(`mipmap-${name}: ${legacyPx}px legacy, ${adaptivePx}px adaptive`);
}

await copyFile(sourceFile, new URL('public/favicon.svg', root));
