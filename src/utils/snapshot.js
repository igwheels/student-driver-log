// Builds and reads shareable "snapshot" links — a read-only view of a
// student's dashboard progress or a single drive, with the data encoded
// directly in the URL (base64 JSON in the hash query string) rather than
// fetched from Firestore. That keeps it viewable by anyone with the link,
// without requiring a signed-in session or making any account data
// queryable by non-owners.

const MAX_ROUTE_POINTS = 40;

function downsampleRoute(route) {
  if (!route || route.length <= MAX_ROUTE_POINTS) return route ?? null;
  const step = (route.length - 1) / (MAX_ROUTE_POINTS - 1);
  const out = [];
  for (let i = 0; i < MAX_ROUTE_POINTS; i++) {
    out.push(route[Math.round(i * step)]);
  }
  return out;
}

function encode(type, data) {
  const json = JSON.stringify({ t: type, d: data });
  // Route UTF-8 bytes through btoa, which only handles Latin1 — needed since
  // a student's name can contain non-ASCII characters.
  return btoa(new TextEncoder().encode(json).reduce((s, byte) => s + String.fromCharCode(byte), ''));
}

function decode(b64) {
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function snapshotUrl(type, data) {
  const b64 = encode(type, data);
  return `${window.location.origin}${import.meta.env.BASE_URL}#/snapshot?d=${encodeURIComponent(b64)}`;
}

export function buildDashboardSnapshotUrl({
  studentFirstName,
  requirementName,
  totalMinutes,
  totalGoalMinutes,
  nightMinutes,
  nightGoalMinutes,
}) {
  return snapshotUrl('dashboard', {
    name: studentFirstName,
    req: requirementName,
    tm: totalMinutes,
    tg: totalGoalMinutes,
    nm: nightMinutes,
    ng: nightGoalMinutes,
  });
}

export function buildLogSnapshotUrl({
  studentFirstName,
  date,
  durationMinutes,
  type,
  timeOfDay,
  distanceMiles,
  startLocation,
  endLocation,
  route,
}) {
  return snapshotUrl('log', {
    name: studentFirstName,
    date,
    dur: durationMinutes,
    type,
    tod: timeOfDay,
    dist: distanceMiles,
    s: startLocation ?? null,
    e: endLocation ?? null,
    r: downsampleRoute(route),
  });
}

export function decodeSnapshotParam(param) {
  if (!param) return null;
  return decode(param);
}
