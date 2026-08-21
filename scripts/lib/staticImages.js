/**
 * Renders the two kinds of images embedded in the weekly progress email:
 * a street map showing a drive's route (composited from OpenStreetMap
 * tiles, same tile server the app's live map uses — no API key), and a
 * gauge matching the dashboard's speedometer-style progress dial. Both are
 * plain PNGs (email clients can't run the app's Leaflet/SVG code), attached
 * to the email as inline cid images.
 */
import { createCanvas, loadImage } from '@napi-rs/canvas';

const TILE_SIZE = 256;
const USER_AGENT = 'StudentDriverLogWeeklyEmail/1.0 (+https://igwheels.github.io/student-driver-log/)';

function lonToPx(lon, zoom) {
  return ((lon + 180) / 360) * TILE_SIZE * 2 ** zoom;
}
function latToPx(lat, zoom) {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * TILE_SIZE * 2 ** zoom;
}

// Picks the highest zoom at which every point still fits inside the target
// canvas (minus padding), same goal as Leaflet's fitBounds on the live map.
function pickZoom(points, width, height, padding, maxZoom = 16, minZoom = 3) {
  for (let zoom = maxZoom; zoom >= minZoom; zoom--) {
    const xs = points.map((p) => lonToPx(p.lng, zoom));
    const ys = points.map((p) => latToPx(p.lat, zoom));
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    if (w <= width - padding * 2 && h <= height - padding * 2) return zoom;
  }
  return minZoom;
}

async function fetchTile(z, x, y) {
  const n = 2 ** z;
  if (y < 0 || y >= n) return null;
  const wrappedX = ((x % n) + n) % n;
  try {
    const res = await fetch(`https://tile.openstreetmap.org/${z}/${wrappedX}/${y}.png`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;
    return loadImage(Buffer.from(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

export async function renderRouteMapPng({ start, end, route }, { width = 560, height = 260 } = {}) {
  const points = route && route.length > 1 ? route : [start, end];
  const padding = 32;
  const zoom = pickZoom(points, width, height, padding);

  const xs = points.map((p) => lonToPx(p.lng, zoom));
  const ys = points.map((p) => latToPx(p.lat, zoom));
  const originX = (Math.min(...xs) + Math.max(...xs)) / 2 - width / 2;
  const originY = (Math.min(...ys) + Math.max(...ys)) / 2 - height / 2;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#E7EEFB';
  ctx.fillRect(0, 0, width, height);

  const firstTileX = Math.floor(originX / TILE_SIZE);
  const firstTileY = Math.floor(originY / TILE_SIZE);
  const lastTileX = Math.floor((originX + width) / TILE_SIZE);
  const lastTileY = Math.floor((originY + height) / TILE_SIZE);

  const tiles = [];
  for (let tx = firstTileX; tx <= lastTileX; tx++) {
    for (let ty = firstTileY; ty <= lastTileY; ty++) {
      tiles.push({ tx, ty });
    }
  }
  const loaded = await Promise.all(
    tiles.map(async ({ tx, ty }) => ({ tx, ty, img: await fetchTile(zoom, tx, ty) }))
  );
  for (const { tx, ty, img } of loaded) {
    if (!img) continue;
    ctx.drawImage(img, tx * TILE_SIZE - originX, ty * TILE_SIZE - originY, TILE_SIZE, TILE_SIZE);
  }

  const toCanvasXY = (p) => [lonToPx(p.lng, zoom) - originX, latToPx(p.lat, zoom) - originY];

  if (points.length > 1) {
    ctx.strokeStyle = '#2F6FDE';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    points.forEach((p, i) => {
      const [x, y] = toCanvasXY(p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  const drawMarker = (p, color) => {
    const [x, y] = toCanvasXY(p);
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  };
  drawMarker(start, '#2FA36B');
  drawMarker(end, '#D8503F');

  return canvas.toBuffer('image/png');
}

export async function renderGaugePng({ label, value, goal, color = '#2F6FDE', size = 220 }) {
  const height = size + 34;
  const canvas = createCanvas(size, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#141C2E';
  ctx.fillRect(0, 0, size, height);

  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  const center = size / 2;
  const outerR = size / 2 - 14;
  const tickCount = 28;
  const sweep = 270;
  const startAngle = -225;

  const toXY = (angleDeg, r) => {
    const rad = (angleDeg * Math.PI) / 180;
    return [center + r * Math.cos(rad), center + r * Math.sin(rad)];
  };

  for (let i = 0; i <= tickCount; i++) {
    const t = i / tickCount;
    const angle = startAngle + t * sweep;
    const isMajor = i % 7 === 0;
    const [x1, y1] = toXY(angle, outerR);
    const [x2, y2] = toXY(angle, outerR - (isMajor ? 16 : 10));
    ctx.strokeStyle = t <= pct + 0.001 ? color : 'rgba(255,255,255,0.18)';
    ctx.lineWidth = isMajor ? 3.5 : 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const [nx, ny] = toXY(startAngle + pct * sweep, outerR - 30);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(center, center);
  ctx.lineTo(nx, ny);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(center, center, 6, 0, Math.PI * 2);
  ctx.fill();

  const fmt = (mins) => `${Math.floor(mins / 60)}h${String(Math.round(mins % 60)).padStart(2, '0')}m`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(fmt(value), center, center + 34);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '14px sans-serif';
  ctx.fillText(`of ${Math.round(goal / 60)}h goal`, center, center + 56);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(label.toUpperCase(), center, size + 24);

  return canvas.toBuffer('image/png');
}
