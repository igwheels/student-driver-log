const EARTH_RADIUS_MILES = 3958.8;

// Ignore GPS points that jump further than this in one reading — almost
// always a bad fix rather than the car actually teleporting.
const MAX_JUMP_MILES = 1;

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineMiles(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

/**
 * Reads the current geolocation permission state ('granted' | 'denied' |
 * 'prompt' | 'unsupported') and calls onChange with it whenever it changes.
 * Returns an unsubscribe function.
 */
export function watchLocationPermissionStatus(onChange) {
  if (!navigator.permissions?.query) {
    onChange('unsupported');
    return () => {};
  }

  let status = null;
  try {
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((result) => {
        status = result;
        onChange(status.state);
        status.onchange = () => onChange(status.state);
      })
      .catch(() => onChange('unsupported'));
  } catch {
    // Some browsers throw synchronously for an unsupported permission name
    // rather than rejecting the promise.
    onChange('unsupported');
  }

  return () => {
    if (status) status.onchange = null;
  };
}

export function requestLocationPermission() {
  if (!navigator.geolocation) return;
  // Triggers the browser's permission prompt now, so it's already granted
  // (or denied) by the time a drive timer needs live position updates.
  navigator.geolocation.getCurrentPosition(
    () => {},
    () => {},
    { enableHighAccuracy: false, timeout: 5000 }
  );
}

/**
 * Tracks cumulative miles traveled — as the sum of the distance between each
 * consecutive GPS fix along the way, not a straight line from start to end —
 * plus the full sequence of fixes, via navigator.geolocation.watchPosition.
 * Returns a stop() function; onUpdate({ miles, start, end, route }) fires as
 * new fixes arrive, where start/end are { lat, lng } and route is the full
 * [{ lat, lng }, ...] path, once at least one good fix has come in.
 */
export function startMileageTracking(onUpdate) {
  if (!navigator.geolocation) return () => {};

  let totalMiles = 0;
  let lastFix = null;
  const route = [];
  let watchId = null;

  const report = () =>
    onUpdate({
      miles: totalMiles,
      start: route[0] ?? null,
      end: route[route.length - 1] ?? null,
      route: route.slice(),
    });

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      // A very inaccurate fix can swing distance wildly; skip it.
      if (accuracy != null && accuracy > 50) return;

      if (lastFix) {
        const delta = haversineMiles(lastFix.latitude, lastFix.longitude, latitude, longitude);
        // Also skip an implausible jump between fixes — it never happened,
        // so it shouldn't distort the mileage total or appear in the route.
        if (delta > MAX_JUMP_MILES) return;
        totalMiles += delta;
      }
      lastFix = { latitude, longitude };
      route.push({ lat: latitude, lng: longitude });
      report();
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );

  return () => {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
  };
}
