// Pure signal processing for hard-brake / harsh-turn detection — no Capacitor,
// no DOM. Runs identically in the app, in the Node replay harness
// (scripts/replay-telematics.mjs), and in any future test. The plugin
// plumbing and the debug/capture side effects live in telematics.js.

export const G = 9.80665;

// ───────────────────────────────────────────────────────────────────────────
// UNVERIFIED THRESHOLDS.
//
// The DEV-34 spec is explicit: tune these against real driving data before
// the feature is trusted — false positives would erode confidence in the
// safety cue. Detection is OFF by default (see telematicsMode in
// telematics.js). Capture a drive with sdl_telematics='capture', then sweep
// values offline with scripts/replay-telematics.mjs. Exported as a plain
// mutable object so the harness can override without editing this file.
// ───────────────────────────────────────────────────────────────────────────
export const THRESHOLDS = {
  // Hard braking: smoothed linear-accel magnitude, m/s². ~0.3 g is firm
  // normal braking; 0.45 g a deliberate hard stop; ~0.7 g+ is ABS territory.
  // Keys off magnitude, so hard throttle also trips it until an
  // orientation-calibration step exists to isolate the forward axis.
  hardBrakeMs2: 0.45 * G,
  // Harsh turn: smoothed yaw rate about the vertical axis, deg/s. A brisk
  // corner is ~15–25; a swerve or a corner taken too fast passes ~40.
  harshTurnDegS: 40,
  // The signal must stay past threshold this long before an event fires —
  // rejects one-off spikes (a pothole, the phone being picked up).
  eventMinDurationMs: 250,
  // Minimum gap between events of the same type.
  eventCooldownMs: 3000,
  // Below this GPS speed it isn't a driving event (phone jostled while parked
  // or carried). Lenient when speed is unknown — see processSample.
  minSpeedMph: 5,
  // Exponential smoothing on the event signals (0 = frozen, 1 = raw sample).
  signalSmoothing: 0.35,
  // Slow low-pass that estimates the gravity vector, subtracted from the
  // accel triple to recover linear acceleration. Frozen mid-manoeuvre (see
  // processSample) so a sustained brake / long corner isn't absorbed into it.
  gravitySmoothing: 0.02,
  // Faster gravity adaptation during warmup, so the estimate converges from
  // zero within warmupMs instead of over ~1 min.
  gravityWarmupSmoothing: 0.1,
  // Ignore this first stretch while the gravity estimate converges.
  warmupMs: 1000,
};

export function createTelematicsState() {
  return {
    startedAt: null,
    gx: 0,
    gy: 0,
    gz: 0,
    smBrake: 0,
    smYaw: 0,
    overSince: { 'hard-brake': null, 'harsh-turn': null },
    lastFired: { 'hard-brake': 0, 'harsh-turn': 0 },
  };
}

/**
 * Flattens a @capacitor/motion 'accel' event into the sample shape
 * processSample and the capture CSV both use: { t, x, y, z, rAlpha, speedMph }.
 *
 * x/y/z are accelerationIncludingGravity when present (the only field Android
 * reliably fills), else acceleration. rAlpha is |rotationRate.alpha| (yaw).
 */
export function normalizeMotionSample(event, { t = Date.now(), speedMph = null } = {}) {
  const a = event.accelerationIncludingGravity || event.acceleration || {};
  return {
    t,
    x: a.x || 0,
    y: a.y || 0,
    z: a.z || 0,
    rAlpha: Math.abs(event.rotationRate?.alpha || 0),
    speedMph,
  };
}

/**
 * Feeds one sample through the detector. Mutates `state`. Returns
 * `{ events: [{ type, magnitude, at }], debug: {...} }`.
 *
 * `opts.thresholds` overrides THRESHOLDS wholesale — the harness passes a
 * merged copy to sweep values.
 */
export function processSample(state, sample, opts = {}) {
  const th = opts.thresholds || THRESHOLDS;
  const now = sample.t;
  if (state.startedAt == null) state.startedAt = now;
  const warm = now - state.startedAt >= th.warmupMs;

  // Gravity estimate: converge fast during warmup; after that adapt slowly,
  // but freeze entirely once a manoeuvre is underway (judged from the last
  // sample's smoothed values) so a sustained hard brake or long corner isn't
  // low-passed into "gravity" and self-cancelled. Both failure directions
  // were caught with scripts/replay-telematics.mjs.
  let gAlpha;
  if (!warm) {
    gAlpha = th.gravityWarmupSmoothing;
  } else if (
    state.smBrake > th.hardBrakeMs2 * 0.5 ||
    state.smYaw > th.harshTurnDegS * 0.5
  ) {
    gAlpha = 0;
  } else {
    gAlpha = th.gravitySmoothing;
  }
  state.gx += gAlpha * (sample.x - state.gx);
  state.gy += gAlpha * (sample.y - state.gy);
  state.gz += gAlpha * (sample.z - state.gz);

  const linMag = Math.hypot(sample.x - state.gx, sample.y - state.gy, sample.z - state.gz);
  const yawRate = Math.abs(sample.rAlpha || 0);

  state.smBrake += th.signalSmoothing * (linMag - state.smBrake);
  state.smYaw += th.signalSmoothing * (yawRate - state.smYaw);

  const speed = sample.speedMph;
  const movingFastEnough = speed == null || speed >= th.minSpeedMph;

  const events = [];
  const consider = (type, over) => {
    if (!warm || !over || !movingFastEnough) {
      state.overSince[type] = null;
      return;
    }
    if (state.overSince[type] == null) state.overSince[type] = now;
    if (now - state.overSince[type] < th.eventMinDurationMs) return;
    if (now - state.lastFired[type] < th.eventCooldownMs) return;
    state.lastFired[type] = now;
    state.overSince[type] = null;
    events.push({
      type,
      magnitude: type === 'harsh-turn' ? state.smYaw : state.smBrake,
      at: now,
    });
  };

  // A turn also throws linear accel, so gate hard-brake on low yaw to keep one
  // physical event from firing as both.
  consider('hard-brake', state.smBrake > th.hardBrakeMs2 && state.smYaw < th.harshTurnDegS);
  consider('harsh-turn', state.smYaw > th.harshTurnDegS);

  return {
    events,
    debug: {
      t: now,
      linMag,
      yawRate,
      smBrake: state.smBrake,
      smYaw: state.smYaw,
      speedMph: speed ?? null,
      warm,
      movingFastEnough,
      holdBrakeMs: state.overSince['hard-brake'] == null ? 0 : now - state.overSince['hard-brake'],
      holdYawMs: state.overSince['harsh-turn'] == null ? 0 : now - state.overSince['harsh-turn'],
    },
  };
}
