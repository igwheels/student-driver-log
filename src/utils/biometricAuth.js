/**
 * Biometric unlock — DEV-27/28/29.
 *
 * This is deliberately NOT an authentication system. It's a local unlock
 * gate in front of an already-signed-in Firebase session: Firebase's own
 * persisted session (browserLocalPersistence, see src/firebase.js) is what
 * actually keeps someone signed in across app restarts, same as it always
 * has. Biometrics only decide whether the *already-authenticated* app is
 * visible right now. Nothing here touches AppContext's auth state or
 * Firestore security rules — see DEV-8's own description, which says the
 * same thing.
 *
 * Session policy (DEV-8 phase 4): the gate is only offered in place of a
 * full sign-in for a bounded window. armBiometricSession() stamps the
 * moment of the last full (password/Google) sign-in and the device's boot
 * session; evaluateBiometricSession() refuses the gate — forcing a full
 * sign-in — once that stamp is more than MAX_BIOMETRIC_SESSION_MS old or
 * the device has rebooted since. A plain force-quit and relaunch is
 * neither of those, so it still unlocks with biometrics alone.
 *
 * Plugin: @aparajita/capacitor-biometric-auth (chosen over two
 * alternatives — see the DEV-27 commit message for why). Every import of
 * it is dynamic (`await import(...)`), gated behind
 * Capacitor.isNativePlatform() first, so it never even downloads into the
 * web bundle — DEV-29's requirement, verified against the actual built
 * output, not just by reading this file. Do not add a static top-level
 * import of the plugin package here.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

// Small app-local native plugin (ios/App/RebootCheckPlugin.swift).
// registerPlugin returns a proxy whose calls reject with "not implemented"
// when the native side isn't registered — getDeviceBootTime() turns that
// into null and the reboot half of the policy quietly stops applying (the
// 30-day half is pure JS and always does). Being in the App target is NOT
// enough to register it: Capacitor only auto-registers the classes `cap
// sync` writes into capacitor.config.json's packageClassList, which it
// builds from node_modules alone. ios/App/MainViewController.swift does
// the registration by hand — see its comment. This failed silently for a
// while, so if bootDelta ever reads null again, look there first.
const RebootCheck = registerPlugin('RebootCheck');

// Per-account, not per-device: a device could plausibly see more than one
// Firebase account over its life (e.g. a shared family tablet), and one
// account enabling biometric unlock should not silently gate — or silently
// NOT gate — a different account that signs in later. Scoping by uid means
// each account's choice is independent.
const enabledKey = (uid) => `sdl_biometric_enabled_${uid}`;
const askedKey = (uid) => `sdl_biometric_asked_${uid}`;
// Session-policy stamps, set by armBiometricSession(), read by
// evaluateBiometricSession(): the ms timestamp of the last full sign-in,
// and the device boot time (ms since epoch) observed at that moment.
const anchorKey = (uid) => `sdl_biometric_anchor_${uid}`;
const bootKey = (uid) => `sdl_biometric_boot_${uid}`;

// How long biometric unlock may stand in for a full sign-in before the
// app demands the password/Google flow again.
export const MAX_BIOMETRIC_SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
// getDeviceBootTime() reads KERN_BOOTTIME, which only moves on a real
// restart — plus a small shift whenever the wall clock is corrected (NTP,
// manual change). Compare with slack so a clock correction isn't mistaken
// for a reboot; a real reboot shifts it far more than any plausible drift.
const BOOT_TIME_TOLERANCE_MS = 3 * 60 * 1000; // 3 minutes

function readFlag(key) {
  try {
    return localStorage.getItem(key) === 'true';
  } catch (e) {
    return false; // can't read -> treat as "no", never as "yes"
  }
}

function writeFlag(key, value) {
  try {
    if (value) localStorage.setItem(key, 'true');
    else localStorage.removeItem(key);
  } catch (e) {
    console.warn('Failed to persist biometric preference:', e);
  }
}

function readNumber(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    return null;
  }
}

function writeNumber(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (e) {
    console.warn('Failed to persist biometric session stamp:', e);
  }
}

function removeKey(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    /* nothing to do */
  }
}

export const isBiometricEnabledForUser = (uid) => (uid ? readFlag(enabledKey(uid)) : false);

export function setBiometricEnabledForUser(uid, enabled) {
  if (!uid) return;
  writeFlag(enabledKey(uid), enabled);
  if (enabled) {
    // Turning it on counts as arming the session — the caller has just
    // proven identity (the enroll prompt follows a fresh sign-in; the
    // Account toggle runs its own authenticate() first).
    armBiometricSession(uid);
  } else {
    removeKey(anchorKey(uid));
    removeKey(bootKey(uid));
  }
}

// Wall-clock time (ms since epoch) the device last booted, read from the
// kernel. null when it can't be determined (web, or the RebootCheck plugin
// isn't registered) — callers treat null as "can't tell", never as
// "rebooted".
async function getDeviceBootTime() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { bootTime } = await RebootCheck.getBootTime();
    return Number.isFinite(bootTime) ? bootTime : null;
  } catch (e) {
    return null;
  }
}

// Call after a full (password/Google) sign-in and whenever biometric
// unlock is switched on: resets the 30-day window and records the current
// boot session so a later restart invalidates the gate. Fire-and-forget —
// the native boot-time read is quick and a failure just leaves the reboot
// check disabled for this arming.
export async function armBiometricSession(uid) {
  if (!uid) return;
  writeNumber(anchorKey(uid), Date.now());
  const boot = await getDeviceBootTime();
  if (boot != null) writeNumber(bootKey(uid), boot);
  else removeKey(bootKey(uid));
}

// Whether a persisted session may still be unlocked with biometrics alone.
// Returns { ok, reason }; every reason other than 'ok' means "make the
// user do a full sign-in". 'expired' = past the 30-day window; 'reboot' =
// device restarted since arming; 'not-armed'/'disabled' = nothing to gate.
export async function evaluateBiometricSession(uid) {
  if (!uid || !isBiometricEnabledForUser(uid)) return { ok: false, reason: 'disabled' };
  const anchor = readNumber(anchorKey(uid));
  if (anchor == null) return { ok: false, reason: 'not-armed' };
  const ageMs = Date.now() - anchor;
  if (ageMs > MAX_BIOMETRIC_SESSION_MS) return { ok: false, reason: 'expired', ageMs };
  const storedBoot = readNumber(bootKey(uid));
  const currentBoot = await getDeviceBootTime();
  const bootDelta =
    storedBoot != null && currentBoot != null ? Math.abs(currentBoot - storedBoot) : null;
  if (bootDelta != null && bootDelta > BOOT_TIME_TOLERANCE_MS) {
    return { ok: false, reason: 'reboot', bootDelta, storedBoot, currentBoot };
  }
  return { ok: true, reason: 'ok', ageMs, bootDelta };
}

// Whether we've already offered (and the user either accepted or declined)
// the enrollment prompt for this account — so a decline doesn't get
// re-asked on every subsequent sign-in, only ever asked once per account
// per device.
export const hasAskedBiometricEnrollment = (uid) => (uid ? readFlag(askedKey(uid)) : true);
export const markBiometricEnrollmentAsked = (uid) => uid && writeFlag(askedKey(uid), true);

// Every user-visible string in this feature (the enable prompt, the
// Account.jsx toggle, the lock screen, the reason shown inside the OS
// prompt itself) has to name the right mechanism — "Enable Face ID" is
// simply wrong on a Touch ID iPhone SE or an Android fingerprint device.
// Mirrors @aparajita/capacitor-biometric-auth's BiometryType enum ordinals
// (none=0, touchId=1, faceId=2, fingerprintAuthentication=3,
// faceAuthentication=4, irisAuthentication=5) as plain numbers rather than
// importing the enum — importing anything from the plugin package outside
// the dynamic import() calls below would risk pulling plugin code into the
// eager web bundle, undoing DEV-29's gating for no real benefit, since
// these ordinals are stable API surface, not implementation detail.
// Deliberately plain noun phrases, not "X unlock" — every caller's own
// sentence supplies the word "unlock" ("Unlock with {label}", "Use
// {label} to unlock…"), and a label that already contains it reads as a
// stutter ("Unlock with fingerprint unlock").
function labelForBiometryType(biometryType) {
  switch (biometryType) {
    case 1: return 'Touch ID';
    case 2: return 'Face ID';
    case 3: return 'your fingerprint';
    case 4: return 'face recognition';
    case 5: return 'iris recognition';
    default: return 'biometrics';
  }
}

// { isAvailable, biometryType, label, ... } on native with hardware+
// enrollment present — label is this module's own addition (the plugin's
// result doesn't include one), the human-readable name every caller
// should use in place of a hardcoded "Face ID". A harmless "not
// available" shape (label included, generic) everywhere else (web,
// native without biometrics) so callers never need their own platform
// branch or their own copy of this mapping.
export async function checkBiometryAvailability() {
  if (!Capacitor.isNativePlatform()) {
    return { isAvailable: false, biometryType: 0, label: 'biometrics', code: 'not-native' };
  }
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    const result = await BiometricAuth.checkBiometry();
    return { ...result, label: labelForBiometryType(result.biometryType) };
  } catch (e) {
    // Plugin threw outright (shouldn't happen per its own API, but this is
    // exactly the kind of failure that must fall back quietly, not crash
    // the app) — report as unavailable rather than letting it propagate.
    return { isAvailable: false, biometryType: 0, label: 'biometrics', code: 'error', message: e?.message };
  }
}

// The OS biometric sheet takes over the foreground, so presenting it fires
// an app inactive -> active transition all on its own — and the active
// event lands just *after* authenticate() settles. AppContext's resume
// re-lock handler must not treat that as a real resume, or every
// successful unlock re-locks the app immediately: an infinite prompt loop.
// This counter is raised around every prompt and held briefly past its
// resolution so that trailing active event can be recognised and ignored.
// A plain boolean would be wrong — Account.jsx and the enroll prompt can
// each have a prompt in flight independently.
let biometricPromptDepth = 0;

export const isBiometricPromptActive = () => biometricPromptDepth > 0;

// Returns a result object rather than throwing, on purpose: every caller
// needs to branch on *which* outcome this was (success / user chose to
// cancel / genuinely failed / not available at all) to decide whether to
// retry, fall back silently, or show the fallback UI — a thrown error
// would just push that same branching into every catch block instead.
//
// allowDeviceCredential is left false: a device passcode fallback is a
// different, OS-level mechanism than "biometric," and this app already
// has its own explicit fallback (normal Firebase sign-in, offered by the
// caller) — stacking a second, OS-level fallback on top would blur what
// "biometric unlock" actually means here.
export async function authenticateWithBiometrics(reason) {
  if (!Capacitor.isNativePlatform()) {
    return { ok: false, code: 'not-native' };
  }
  biometricPromptDepth += 1;
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: 'Use password',
      allowDeviceCredential: false,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, code: err?.code || 'unknown', message: err?.message };
  } finally {
    // Stay "active" well past the sheet's dismissal. The dismissal has to
    // animate out, then iOS posts didBecomeActive, then @capacitor/app
    // marshals appStateChange(active) across the bridge, then AppContext's
    // dynamic import()'d listener handles it — several hundred ms of slack
    // on a cold start, and the listener can also miss the *inactive* edge
    // entirely if it registered late, which defeats the duration guard.
    // 3s covers all of that and is still imperceptible to someone who
    // genuinely backgrounds the app right after unlocking.
    setTimeout(() => {
      biometricPromptDepth = Math.max(0, biometricPromptDepth - 1);
    }, 3000);
  }
}
// Resume-based re-locking lives in AppContext, driven straight off
// @capacitor/app's appStateChange. The biometric plugin ships an
// addResumeListener(), but it fires on *every* foreground — including the
// inactive->active cycle the OS auth sheet itself causes when it closes —
// which turned every successful unlock into an immediate re-lock loop.
// @capacitor/app must be a DIRECT dependency (it's in package.json) for
// its native side to register: a plugin pulled in only transitively by
// another plugin is not picked up by `cap sync`.
