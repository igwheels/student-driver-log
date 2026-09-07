import { Motion } from '@capacitor/motion';

const G = 9.80665;

// ───────────────────────────────────────────────────────────────────────────
// UNVERIFIED THRESHOLDS.
//
// The DEV-34 spec is explicit: these must be tuned against real driving data
// before the feature is trusted, because false positives would erode
// confidence in the safety cue. So detection is OFF by default — see
// telematicsEnabled() — and is a field-tuning switch until calibrated. The
// numbers below are physically-reasoned starting points, not measured.
// ───────────────────────────────────────────────────────────────────────────

// Hard braking: sustained linear deceleration. ~0.3 g is firm normal braking;
// 0.45 g is a deliberate hard stop; ABS/emergency territory is ~0.7 g+. Note
// this currently keys off longitudinal-accel *magnitude*, so hard throttle
// trips it too — separating brake from accelerate needs the car's forward
// axis, which needs an orientation-calibration step this version doesn't do.
const HARD_BRAKE_MS2 = 0.45 * G;

// Harsh turn: yaw rate about the vertical axis. A brisk corner is ~15–25
// deg/s; a swerve or a corner taken too fast climbs past ~40.
const HARSH_TURN_DEG_S = 40;

// The signal must stay past threshold this long — rejects one-off spikes
// (a pothole, the phone being picked up).
const EVENT_MIN_DURATION_MS = 250;

// At most one event of each type per this window.
const EVENT_COOLDOWN_MS = 3000;

// Below this speed it isn't a driving event — a phone jostled while parked or
// carried. Uses the GPS speed already flowing through geo.js; when speed is
// unknown (device doesn't report it) the gate is lenient rather than mute the
// feature entirely.
const MIN_SPEED_MPH = 5;

// Exponential smoothing on the event signals (0 = frozen, 1 = raw sample).
const SIGNAL_SMOOTHING = 0.35;
// Much slower low-pass that estimates the gravity vector, so it can be
// subtracted from accelerationIncludingGravity (the only field Android
// reliably populates) to recover linear acceleration.
const GRAVITY_SMOOTHING = 0.02;
// Ignore the first second while the gravity estimate converges from zero.
const WARMUP_MS = 1000;

const PREF_KEY = 'sdl_telematics';

/**
 * Whether hard-brake / harsh-turn detection runs during a drive. Defaults
 * OFF — the thresholds above are unverified, and the spec says not to trust
 * them until they're checked against real drives. Flip it on (localStorage
 * 'sdl_telematics' = 'on') for field tuning.
 */
export function telematicsEnabled() {
  try {
    return localStorage.getItem(PREF_KEY) === 'on';
  } catch {
    return false;
  }
}

export function setTelematicsEnabled(on) {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    // Non-persistent is fine — it just reverts to the (off) default.
  }
}

/**
 * Starts accelerometer/gyro monitoring for the duration of a drive.
 *
 * `getSpeedMph()` is polled per sample for the speed gate; `onEvent({ type,
 * magnitude, at })` fires on a detected 'hard-brake' or 'harsh-turn'. The
 * caller decides what to do with an event (buzz, count, record) — this
 * module is detection only.
 *
 * Returns a stop() function synchronously; listener attach and the iOS
 * motion-permission request happen in the background and are unwound by
 * stop() whether or not they finished.
 */
export function startDriveTelematics({ getSpeedMph, onEvent } = {}) {
  let stopped = false;
  let accelHandle = null;
  const startedAt = Date.now();

  let gx = 0;
  let gy = 0;
  let gz = 0;
  let smBrake = 0;
  let smYaw = 0;
  const overSince = { 'hard-brake': null, 'harsh-turn': null };
  const lastFired = { 'hard-brake': 0, 'harsh-turn': 0 };

  const evaluate = (type, over, magnitude, now, movingFastEnough) => {
    if (!over || !movingFastEnough) {
      overSince[type] = null;
      return;
    }
    if (overSince[type] == null) overSince[type] = now;
    if (now - overSince[type] < EVENT_MIN_DURATION_MS) return;
    if (now - lastFired[type] < EVENT_COOLDOWN_MS) return;
    lastFired[type] = now;
    overSince[type] = null;
    onEvent?.({ type, magnitude, at: now });
  };

  const onSample = (e) => {
    const now = Date.now();
    const s = e.accelerationIncludingGravity || e.acceleration || {};
    const x = s.x || 0;
    const y = s.y || 0;
    const z = s.z || 0;

    gx += GRAVITY_SMOOTHING * (x - gx);
    gy += GRAVITY_SMOOTHING * (y - gy);
    gz += GRAVITY_SMOOTHING * (z - gz);

    const linMag = Math.hypot(x - gx, y - gy, z - gz);
    const yawRate = Math.abs(e.rotationRate?.alpha || 0);

    smBrake += SIGNAL_SMOOTHING * (linMag - smBrake);
    smYaw += SIGNAL_SMOOTHING * (yawRate - smYaw);

    if (now - startedAt < WARMUP_MS) return;

    const speed = getSpeedMph?.();
    const movingFastEnough = speed == null || speed >= MIN_SPEED_MPH;

    // A turn also throws linear accel, so gate hard-brake on low yaw to keep
    // one physical event from firing as both.
    evaluate('hard-brake', smBrake > HARD_BRAKE_MS2 && smYaw < HARSH_TURN_DEG_S, smBrake, now, movingFastEnough);
    evaluate('harsh-turn', smYaw > HARSH_TURN_DEG_S, smYaw, now, movingFastEnough);
  };

  (async () => {
    // iOS 13+ (Safari and the WKWebView) gate motion behind an explicit
    // permission call that must come from a user gesture. The drive starts
    // from a tap, but the async hop here may already be past that window; if
    // the request rejects, telematics just doesn't run this drive.
    try {
      const req =
        typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission;
      if (typeof req === 'function') {
        const res = await req.call(DeviceMotionEvent);
        if (res !== 'granted') return;
      }
    } catch {
      return;
    }
    if (stopped) return;

    try {
      accelHandle = await Motion.addListener('accel', onSample);
    } catch {
      return;
    }
    if (stopped) accelHandle?.remove?.();
  })();

  return () => {
    stopped = true;
    accelHandle?.remove?.();
  };
}
