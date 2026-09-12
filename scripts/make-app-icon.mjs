/**
 * Generate the native app-icon source images from public/logo.png.
 *
 * public/logo.png is the brand logo: the navy rounded-square artwork
 * (white car + checklist + "Student Driver Log") sitting on a white
 * margin, with its own baked-in rounded corners. A native app icon has to
 * be a full-bleed opaque square — iOS and Android apply their own corner
 * mask — so this script trims the white margin, squares the art, cuts the
 * baked corners back to transparent, and composites it onto a solid brand
 * navy field. The corner-cut radius is ~iOS's own squircle, so the flat
 * navy that shows through at the corners is exactly the region the OS
 * clips anyway.
 *
 * Outputs (consumed by `npx capacitor-assets generate`):
 *   resources/icon.png            1024²  opaque, full-bleed  (iOS + legacy Android)
 *   resources/icon-background.png 1024²  solid brand navy    (Android adaptive)
 *   resources/icon-foreground.png 1024²  art in the safe zone, transparent
 *   resources/splash.png          2732²  logo on brand navy  (launch screen)
 *   resources/splash-dark.png     2732²  identical — the brand field is
 *                                        already dark, so there is no
 *                                        separate light treatment to make
 *                                        (and no white launch flash).
 *
 * Run via `npm run icons` (which also runs capacitor-assets + cap sync).
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const SRC = 'public/logo.png';
const OUT = 'resources';
const SIZE = 1024;
// Brand navy — matches --navy in src/styles/theme.css and the manifest
// theme_color. The logo's own field is a near-black navy gradient; this
// sits behind the trimmed corners, under the OS mask.
const NAVY = '#141C2E';
const CORNER_RADIUS = Math.round(SIZE * 0.235);

const cornerMask = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">` +
    `<rect width="${SIZE}" height="${SIZE}" rx="${CORNER_RADIUS}" ry="${CORNER_RADIUS}" fill="#fff"/>` +
    `</svg>`,
);

// Trim the white margin, square it off (cover-crops a few px of the
// rounded-corner zone top/bottom), then knock the baked corners out to
// transparent.
const art = await sharp(SRC)
  .trim({ background: '#ffffff', threshold: 40 })
  .resize(SIZE, SIZE, { fit: 'cover', position: 'center' })
  .ensureAlpha()
  .composite([{ input: cornerMask, blend: 'dest-in' }])
  .png()
  .toBuffer();

await mkdir(OUT, { recursive: true });

// iOS + legacy Android launcher: opaque, art to the edges, navy corners.
// iOS rejects an icon with an alpha channel, so flatten AND drop alpha.
await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: NAVY } })
  .composite([{ input: art }])
  .flatten({ background: NAVY })
  .removeAlpha()
  .png()
  .toFile(`${OUT}/icon.png`);

// Android adaptive background layer.
await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: NAVY } })
  .png()
  .toFile(`${OUT}/icon-background.png`);

// Android adaptive foreground layer — the same full-bleed art (transparent
// corners). capacitor-assets adds its own ~16.7% inset and the launcher
// then applies a circle/squircle mask, which lands on the navy the
// background layer supplies, so nothing important is clipped.
await sharp(art).toFile(`${OUT}/icon-foreground.png`);

// Launch screen: the logo on the brand navy field. Same image for light
// and dark — the brand is dark either way, which also avoids the white
// flash capacitor-assets' auto-splash would otherwise show in light mode.
const SPLASH = 2732;
const splashLogo = await sharp(art)
  .resize(Math.round(SPLASH * 0.30), Math.round(SPLASH * 0.30))
  .toBuffer();
const splash = await sharp({ create: { width: SPLASH, height: SPLASH, channels: 3, background: NAVY } })
  .composite([{ input: splashLogo, gravity: 'center' }])
  .png()
  .toBuffer();
await sharp(splash).toFile(`${OUT}/splash.png`);
await sharp(splash).toFile(`${OUT}/splash-dark.png`);

console.log(
  'Wrote',
  ['icon.png', 'icon-background.png', 'icon-foreground.png', 'splash.png', 'splash-dark.png']
    .map((f) => `${OUT}/${f}`)
    .join(', '),
);
