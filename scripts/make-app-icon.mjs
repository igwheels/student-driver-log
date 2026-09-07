// Derives the app-icon source art from public/logo.png:
//   - assets/icon.png            1024² full-bleed (navy tile + mark, no text)
//   - assets/icon-foreground.png 1024² mark on transparent (Android adaptive)
//   - assets/icon-background.png 1024² navy gradient
//   - public/pwa-512.png / pwa-192.png / pwa-maskable-512.png
//
// Then run:  npx @capacitor/assets generate --ios --android
// to slice assets/icon*.png into every native icon size.
//
// public/logo.png itself is left alone — it's the brand mark on white, used
// in-app (Login, topbar) and as the web favicon.

import { mkdirSync, writeFileSync } from 'node:fs';
import { loadImage, createCanvas } from '@napi-rs/canvas';

// Measured from public/logo.png (1254²): the car + checklist mark, cropped
// well inside the dark tile's rounded corners (so no corner arc or white
// page background bleeds in) and above the "STUDENT DRIVER LOG" text. The
// car's mirror tips lose a few px at the sides — an acceptable trade for a
// clean field.
const MARK = { sx: 178, sy: 252, sw: 896, sh: 636 };
// The tile's vertical navy gradient, sampled top → bottom.
const NAVY_TOP = '#1E2C40';
const NAVY_BOTTOM = '#0C1827';

const logo = await loadImage('public/logo.png');

function navyGradient(ctx, size) {
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, NAVY_TOP);
  g.addColorStop(1, NAVY_BOTTOM);
  return g;
}

// Drop the tile's navy so only the white car + coloured marks remain. The
// mark's darkest kept ink (grey binding rings ~#A0A0A0, blue page curl) sits
// well above the navy (max channel < ~95), so a ramp on the max channel
// isolates it cleanly and feathers the antialiased edges.
function keyOutNavy(ctx, size) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const maxC = Math.max(d[i], d[i + 1], d[i + 2]);
    const a = (maxC - 95) / 45; // <95 → 0, >140 → 1
    d[i + 3] = a <= 0 ? 0 : a >= 1 ? 255 : Math.round(a * 255);
  }
  ctx.putImageData(img, 0, 0);
}

// markWidthFrac: mark width as a fraction of the canvas. dyFrac: vertical
// nudge (fraction of canvas). bg: 'gradient' | 'none'. keyOut: drop the navy
// so the mark is isolated on transparency (for the adaptive foreground).
function compose(size, { bg, markWidthFrac, dyFrac = 0, keyOut = false }) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const dw = size * markWidthFrac;
  const dh = dw * (MARK.sh / MARK.sw);
  const dx = (size - dw) / 2;
  const dy = (size - dh) / 2 + size * dyFrac;
  ctx.drawImage(logo, MARK.sx, MARK.sy, MARK.sw, MARK.sh, dx, dy, dw, dh);
  if (keyOut) keyOutNavy(ctx, size);

  if (bg === 'gradient') {
    // paint the gradient behind what's already drawn
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = navyGradient(ctx, size);
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
  }
  return canvas.toBuffer('image/png');
}

mkdirSync('assets', { recursive: true });

// Full-bleed icon — iOS + legacy Android + the PWA sizes. keyOut drops the
// source tile's navy (and its soft edge shadow) so the mark sits on a fresh
// gradient with no ghost rectangle.
const FULL = { bg: 'gradient', markWidthFrac: 0.9, keyOut: true };
writeFileSync('assets/icon.png', compose(1024, FULL));
writeFileSync('public/pwa-512.png', compose(512, FULL));
writeFileSync('public/pwa-192.png', compose(192, FULL));

// Android adaptive foreground: isolated mark on transparency, inside the safe zone.
writeFileSync('assets/icon-foreground.png', compose(1024, { bg: 'none', markWidthFrac: 0.64, keyOut: true }));

// Android adaptive background: the navy gradient, full bleed.
{
  const c = createCanvas(1024, 1024);
  const x = c.getContext('2d');
  x.fillStyle = navyGradient(x, 1024);
  x.fillRect(0, 0, 1024, 1024);
  writeFileSync('assets/icon-background.png', c.toBuffer('image/png'));
}

// Maskable PWA icon: same art, mark shrunk into the maskable safe zone.
writeFileSync('public/pwa-maskable-512.png', compose(512, { bg: 'gradient', markWidthFrac: 0.62, keyOut: true }));

console.log('wrote assets/icon.png, assets/icon-foreground.png, assets/icon-background.png');
console.log('wrote public/pwa-512.png, public/pwa-192.png, public/pwa-maskable-512.png');
console.log('next: npx @capacitor/assets generate --ios --android');
