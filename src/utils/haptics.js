import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// Device-level, not account-level: whether a phone buzzes is a fact about the
// phone riding in the car, not about the login. Stored in localStorage, read
// on this device only.
const PREF_KEY = 'sdl_safety_haptics';

// ms pattern for the Web Vibration fallback: buzz, gap, buzz. The double tap
// is deliberate — a single pulse reads as a notification; two quick ones say
// "look up now". The native path mirrors this with two impacts.
const WEB_PULSE_PATTERN = [50, 40, 50];
const NATIVE_PULSE_GAP_MS = 70;

// Defaults on — the safety cue is the point of the feature. A supervisor who
// finds it startling mid-coaching turns it off on the Account page.
export function safetyHapticsEnabled() {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSafetyHapticsEnabled(on) {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    // An unwritable store is also an unreadable one, so the default (on)
    // applies next read — nothing else to do here.
  }
}

/**
 * Whether this device can produce any haptic at all. iOS Safari and the PWA
 * on iOS have no vibration API — only the native shell does there — so the
 * Account toggle hides itself when this returns false rather than offer a
 * switch that does nothing.
 */
export function hapticsAvailable() {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Haptics')) return true;
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/**
 * A short double-tap for a real-time driving-safety event (hard brake, harsh
 * turn) — an added cue for the supervising adult, alongside whatever the
 * screen shows.
 *
 * Fire-and-forget: never throws and never blocks the caller (the detection
 * loop must not stall on a buzz). No-ops silently when the setting is off
 * (unless `force`) or the device can't vibrate.
 */
export async function pulseSafetyAlert({ force = false } = {}) {
  if (!force && !safetyHapticsEnabled()) return;

  try {
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Haptics')) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await new Promise((resolve) => setTimeout(resolve, NATIVE_PULSE_GAP_MS));
      await Haptics.impact({ style: ImpactStyle.Heavy });
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(WEB_PULSE_PATTERN);
    }
  } catch {
    // A denied or unsupported haptic isn't worth surfacing — the on-screen
    // flag is the primary signal; this only sharpens it.
  }
}
