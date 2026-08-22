const EARTH_RADIUS_MILES = 3958.8;

// Ignore GPS points that jump further than this in one reading — almost
// always a bad fix rather than the car actually teleporting.
const MAX_JUMP_MILES = 1;

// Reject fixes coarser than this when accumulating mileage. This was 50m,
// which turned out to be stricter than a phone in a moving car reliably
// achieves — an urban canyon or an overcast cold start can sit above it for
// a whole drive, and every reading was then dropped in silence, producing a
// drive with no distance and no map. 100m still excludes the ~1-3km readings
// that "approximate location" (iOS Precise Location off, Android approximate
// mode) reports, which is the case actually worth rejecting.
const MAX_ACCURACY_METERS = 100;

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
 *
 * Returns a stop() function. onUpdate({ miles, start, end, route, status,
 * accuracy }) fires immediately and then on every fix or error, where
 * start/end are { lat, lng } and route is the full [{ lat, lng }, ...] path.
 *
 * status is one of:
 *   'unsupported' — no geolocation API in this browser
 *   'waiting'     — watching, no usable fix yet
 *   'tracking'    — recording fixes
 *   'imprecise'   — fixes arriving but too coarse to use (see
 *                   MAX_ACCURACY_METERS); `accuracy` carries the last value
 *   'denied'      — permission refused
 *   'unavailable' — position could not be determined
 *
 * The caller is expected to surface anything other than 'tracking'. Reporting
 * status is the point: these states previously failed silently, so a drive
 * could run to completion having recorded nothing, and the first sign of it
 * was a saved log with no distance and no map.
 */
export function startMileageTracking(onUpdate) {
  let totalMiles = 0;
  let lastFix = null;
  const route = [];
  let watchId = null;
  let status = 'waiting';
  let lastAccuracy = null;

  const report = () =>
    onUpdate({
      miles: totalMiles,
      start: route[0] ?? null,
      end: route[route.length - 1] ?? null,
      route: route.slice(),
      status,
      accuracy: lastAccuracy,
    });

  if (!navigator.geolocation) {
    status = 'unsupported';
    report();
    return () => {};
  }

  report(); // 'waiting', so the UI can say so before the first fix lands

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      lastAccuracy = accuracy ?? null;

      // A very inaccurate fix can swing distance wildly, so it isn't recorded
      // — but it is reported, so the timer can tell the driver that location
      // is too coarse to log rather than just showing nothing.
      if (accuracy != null && accuracy > MAX_ACCURACY_METERS) {
        status = 'imprecise';
        report();
        return;
      }

      if (lastFix) {
        const delta = haversineMiles(lastFix.latitude, lastFix.longitude, latitude, longitude);
        // An implausible jump between fixes doesn't count toward mileage — it
        // is a gap in tracking (backgrounded app, tunnel), not distance we can
        // vouch for. lastFix still advances: leaving it behind would measure
        // every later fix against a stale point, and once the car had moved
        // more than MAX_JUMP_MILES away, every one of them would be rejected
        // too and tracking would never recover for the rest of the drive.
        if (delta <= MAX_JUMP_MILES) totalMiles += delta;
      }

      lastFix = { latitude, longitude };
      route.push({ lat: latitude, lng: longitude });
      status = 'tracking';
      report();
    },
    (error) => {
      if (error.code === error.PERMISSION_DENIED) status = 'denied';
      else if (error.code === error.POSITION_UNAVAILABLE) status = 'unavailable';
      // A TIMEOUT just means no fix yet; watchPosition keeps trying, so the
      // honest state is still 'waiting' unless we already had one.
      else if (route.length === 0) status = 'waiting';
      report();
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );

  return () => {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
  };
}
