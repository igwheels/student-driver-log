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

export function requestLocationPermission() {
  if (!navigator.geolocation) return;
  // Use watchPosition (rather than a one-shot getCurrentPosition) so the
  // browser recognizes this as an ongoing-use request — that's what gets
  // Chrome/Safari to offer "Allow while using the app" vs. "Allow once"
  // instead of a plain Allow/Block prompt. Triggering it now, right after
  // login, means it's already resolved by the time a drive timer needs
  // live position updates.
  const watchId = navigator.geolocation.watchPosition(
    () => navigator.geolocation.clearWatch(watchId),
    () => navigator.geolocation.clearWatch(watchId),
    { enableHighAccuracy: false, timeout: 5000 }
  );
}

/**
 * Tracks cumulative miles traveled via navigator.geolocation.watchPosition.
 * Returns a stop() function; onUpdate(totalMiles) fires as new fixes arrive.
 */
export function startMileageTracking(onUpdate) {
  if (!navigator.geolocation) return () => {};

  let totalMiles = 0;
  let lastFix = null;
  let watchId = null;

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      // A very inaccurate fix can swing distance wildly; skip it.
      if (accuracy != null && accuracy > 50) return;

      if (lastFix) {
        const delta = haversineMiles(lastFix.latitude, lastFix.longitude, latitude, longitude);
        if (delta <= MAX_JUMP_MILES) {
          totalMiles += delta;
          onUpdate(totalMiles);
        }
      }
      lastFix = { latitude, longitude };
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );

  return () => {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
  };
}
