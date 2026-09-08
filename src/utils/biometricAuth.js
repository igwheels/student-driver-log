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
 * Plugin: @aparajita/capacitor-biometric-auth (chosen over two
 * alternatives — see the DEV-27 commit message for why). Every import of
 * it is dynamic (`await import(...)`), gated behind
 * Capacitor.isNativePlatform() first, so it never even downloads into the
 * web bundle — DEV-29's requirement, verified against the actual built
 * output, not just by reading this file. Do not add a static top-level
 * import of the plugin package here.
 */
import { Capacitor } from '@capacitor/core';

// Per-account, not per-device: a device could plausibly see more than one
// Firebase account over its life (e.g. a shared family tablet), and one
// account enabling biometric unlock should not silently gate — or silently
// NOT gate — a different account that signs in later. Scoping by uid means
// each account's choice is independent.
const enabledKey = (uid) => `sdl_biometric_enabled_${uid}`;
const askedKey = (uid) => `sdl_biometric_asked_${uid}`;

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

export const isBiometricEnabledForUser = (uid) => (uid ? readFlag(enabledKey(uid)) : false);
export const setBiometricEnabledForUser = (uid, enabled) => uid && writeFlag(enabledKey(uid), enabled);

// Whether we've already offered (and the user either accepted or declined)
// the enrollment prompt for this account — so a decline doesn't get
// re-asked on every subsequent sign-in, only ever asked once per account
// per device.
export const hasAskedBiometricEnrollment = (uid) => (uid ? readFlag(askedKey(uid)) : true);
export const markBiometricEnrollmentAsked = (uid) => uid && writeFlag(askedKey(uid), true);

// { isAvailable, biometryType, ... } on native with hardware+enrollment
// present; a harmless "not available" shape everywhere else (web, native
// without biometrics) so callers never need their own platform branch.
export async function checkBiometryAvailability() {
  if (!Capacitor.isNativePlatform()) {
    return { isAvailable: false, biometryType: 0, code: 'not-native' };
  }
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    return await BiometricAuth.checkBiometry();
  } catch (e) {
    // Plugin threw outright (shouldn't happen per its own API, but this is
    // exactly the kind of failure that must fall back quietly, not crash
    // the app) — report as unavailable rather than letting it propagate.
    return { isAvailable: false, biometryType: 0, code: 'error', message: e?.message };
  }
}

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
  }
}

// Subscribes to the plugin's resume notifications, used as this app's
// signal for "the app just came back to the foreground, decide whether to
// (re-)lock." The plugin's own stated purpose for this listener is
// refreshing biometry-availability info on resume, not app-lifecycle
// tracking — but it does fire on resume, which is the one event this app
// actually needs, and using it here avoids adding @capacitor/app as a
// second explicit dependency on top of one this plugin already brings in
// transitively. Returns a Promise<{remove(): void}> on native, or a no-op
// handle on web/unavailable so callers don't need their own platform check.
export async function addBiometricResumeListener(callback) {
  if (!Capacitor.isNativePlatform()) {
    return { remove: () => {} };
  }
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    return await BiometricAuth.addResumeListener(callback);
  } catch (e) {
    console.warn('Failed to add biometric resume listener:', e);
    return { remove: () => {} };
  }
}
