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

// GeolocationPositionError codes, per spec.
const GEO_PERMISSION_DENIED = 1;
const GEO_POSITION_UNAVAILABLE = 2;

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

/**
 * Actually asks for a position and reports what happens, rather than what the
 * permission registry claims.
 *
 * navigator.permissions.query() only knows the *site's* permission. It will
 * happily answer 'granted' while the device refuses at the OS level — iOS
 * Settings › Privacy & Security › Location Services › Safari Websites set to
 * Never does exactly that. The Account page previously reported that state as
 * "Allowed", so someone whose location was switched off system-wide was told
 * everything was fine while no drive could record any mileage.
 *
 * Resolves (never rejects) to { state, accuracy?, code?, message? } where
 * state is 'working' | 'imprecise' | 'denied' | 'unavailable' | 'timeout' |
 * 'unsupported'. 'imprecise' means a position came back but is too coarse to
 * accumulate mileage from — the other way tracking fails while looking fine.
 */
export function probeLocationAccess() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ state: 'unsupported' });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const accuracy = position.coords.accuracy ?? null;
        resolve({
          state: accuracy != null && accuracy > MAX_ACCURACY_METERS ? 'imprecise' : 'working',
          accuracy,
        });
      },
      (error) => {
        const code = error?.code ?? null;
        const message = error?.message || '';
        if (code === GEO_PERMISSION_DENIED) resolve({ state: 'denied', code, message });
        else if (code === GEO_POSITION_UNAVAILABLE) resolve({ state: 'unavailable', code, message });
        else resolve({ state: 'timeout', code, message });
      },
      // Deliberately not high-accuracy: this is a "does location work at all"
      // check, and a cached recent fix answers that just as well.
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });
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
  // The browser's own account of the last failure, passed through so the UI
  // can show it. Geolocation failures are otherwise indistinguishable from
  // the outside, and guessing at them from behaviour alone has cost time.
  let lastError = null;

  const report = () =>
    onUpdate({
      miles: totalMiles,
      start: route[0] ?? null,
      end: route[route.length - 1] ?? null,
      route: route.slice(),
      status,
      accuracy: lastAccuracy,
      error: lastError,
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

      lastError = null; // a usable fix supersedes any earlier failure

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
      // Compared against the spec's numeric codes rather than constants read
      // off the error object. `error.code === error.PERMISSION_DENIED` looks
      // equivalent but is not: hand it anything that isn't a real
      // GeolocationPositionError and both sides are undefined, so it matches
      // and every failure — a plain timeout included — is reported as a
      // denied permission. Comparing to 1 and 2 simply doesn't match instead.
      lastError = { code: error?.code ?? null, message: error?.message || '' };
      if (error?.code === GEO_PERMISSION_DENIED) status = 'denied';
      else if (error?.code === GEO_POSITION_UNAVAILABLE) status = 'unavailable';
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
