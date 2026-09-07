# Background Drive Tracking — Spec

**Linear:** none yet (see [§11](#11-open-questions)) · **Date:** 2026-09-07 · **Status:** spec, not started

## 1. The ask

Keep the live drive recording mileage and route while the app is **backgrounded** —
the user has switched to Maps or another app, the phone is still unlocked, the drive
timer is still "running." Today it silently stops.

Not in scope: recording when the app is force-quit, the screen is off for a long
time, or the phone is rebooted. Those raise the permission and store-review bar
sharply (see [§4](#4-ios)/[§5](#5-android)) for a case the product doesn't need yet.

## 2. Why it doesn't work now

`src/utils/geo.js` uses `navigator.geolocation.watchPosition`. The OS suspends the
WebView's JS the moment the app leaves the foreground — timers freeze, the geo watch
goes quiet. `DriveTimer`'s "keep this screen open" hint exists precisely because of
this. The `MAX_JUMP_MILES` guard means the gap doesn't *corrupt* the total, but every
mile driven while backgrounded is lost.

A browser tab (the PWA) genuinely cannot do this — no API keeps JS alive in a
backgrounded tab. **Native shell only.** The PWA keeps the current hint.

## 3. Plugin

**Recommended: `@capacitor-community/background-geolocation`** (MIT, free).

- API: `addWatcher({ backgroundTitle, backgroundMessage, distanceFilter, requestPermissions }, cb)`
  → `cb(location)` fires with `{ latitude, longitude, accuracy, speed, bearing, time }`
  **even while backgrounded**; `removeWatcher({ id })` to stop.
- iOS: `CLLocationManager` with `allowsBackgroundLocationUpdates`; shows the blue
  status-bar pill while active.
- Android: runs a **foreground service** with a persistent notification (title/message
  we supply).
- Verify the Capacitor 8 – compatible version at implementation time.

**Not chosen: `@transistorsoft/capacitor-background-geolocation`** — more robust
(motion-activated GPS, on-device SQLite fix persistence, survives process kill), but
**Android release builds need a paid per-app license**. Revisit only if [§7](#7-surviving-a-process-kill)
proves the free plugin drops too many drives, or if we later want auto drive start/stop.

## 4. iOS

Aim for the **minimal-permission path**:

- `Info.plist`:
  - `NSLocationWhenInUseUsageDescription` — already present.
  - `UIBackgroundModes` → `location` (new).
  - `NSLocationAlwaysAndWhenInUseUsageDescription` — **only** if we later decide we
    need tracking while fully suspended. Not for this scope.
- iOS grants background location under **"When In Use"** as long as
  `allowsBackgroundLocationUpdates` is set, the `location` background mode is
  declared, and the blue indicator is shown — which is exactly the "app open, another
  app in front" case. **"Always" is not required.**
- App Store review: declaring `UIBackgroundModes: location` means review expects a
  user-visible feature that needs continuous location — recording a drive route
  qualifies. Reviewer notes should say so plainly. Staying on "When In Use" keeps
  scrutiny low.

## 5. Android

Also aim for the minimal path:

- A **foreground service started from the "Start Drive" tap** (a user action, app in
  foreground) can use location while backgrounded **without** `ACCESS_BACKGROUND_LOCATION`.
  That permission — and the Play "background location" declaration form + prominent
  in-app disclosure — is only needed for location work *initiated* from the
  background. Confirm the plugin's merged manifest doesn't force
  `ACCESS_BACKGROUND_LOCATION`; if it does, strip it with `tools:node="remove"` or
  accept the Play declaration.
- Permissions actually needed: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`,
  `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` (Android 14+), `POST_NOTIFICATIONS`
  (Android 13+, for the service notification).
- Notification: `"Recording your drive"` / `"12.4 mi so far"`, non-dismissable while
  tracking, tapping it returns to the timer.
- Android 15 tightens FGS-location rules but an active, user-started drive recording
  is a sanctioned use.

## 6. geo.js integration

Keep one accumulation pipeline; swap the source.

- Add `startBackgroundMileageTracking(onUpdate)` in `geo.js`, or branch inside
  `startMileageTracking` on `Capacitor.isNativePlatform()`.
- Native path: `BackgroundGeolocation.addWatcher(...)`. Normalize each callback
  location into the shape the existing code already accumulates — `lastFix`, `route`,
  `totalMiles` via `haversineMiles`, `speedMph` via `metersPerSecondToMph`,
  `maxSpeedMph`. **All the existing gates still apply** (`MAX_ACCURACY_METERS`,
  `MAX_JUMP_MILES`, the speed plausibility gate).
- Status mapping: the plugin surfaces permission-denied and location-unavailable —
  route them to the same `'denied'` / `'unavailable'` / `'imprecise'` / `'tracking'`
  states `onUpdate` already emits, so `DriveTimer`'s `gpsNotice()` needs no new cases.
- `DriveTimer`: on native, replace the "tracking pauses if you switch apps" hint with
  "keeps recording if you switch apps"; drop the wake-lock reliance for correctness
  (still fine to keep for screen-on convenience).
- Telematics (`telematics.js`) is unaffected — it's `@capacitor/motion`, which has its
  own background behaviour tied to the same app-state; out of scope here.

## 7. Surviving a process kill

The free plugin delivers fixes only while the app process is alive (backgrounded is
fine; killed is not). A 20–60 min drive with a foreground service / background mode is
rarely killed, but not never.

- **Checkpoint incrementally:** every ~30 s or N fixes, persist the running
  `{ miles, route, maxSpeedMph, safetyEventCounts, startTime }` to Filesystem (or
  `localStorage`) under an `activeDriveId`. Extends the existing `pendingDrive`
  handoff pattern rather than inventing a new one.
- **On app launch:** if an `activeDrive` checkpoint exists and is recent, offer
  "Resume timing / Save what we recorded / Discard." On normal `endDrive`, clear it.
- This also covers the existing gap where a foregrounded long drive could lose its
  timer state to a tab reload.

## 8. Privacy labels

`docs/privacy-labels.md` **row 3 (Precise location)** needs a wording update: from
"only while a drive timer is actively running in the foreground" to "…running,
including while the app is backgrounded during an active drive." Categories don't
change on either store form — still Precise Location, App Functionality, linked to
user, not used for tracking. If the Android build ends up needing
`ACCESS_BACKGROUND_LOCATION`, the Play Data safety "collected while app is closed or
not in use" answer and the declaration form come into play — another reason to stay
on the foreground-service-from-user-action path.

## 9. Battery

Continuous high-accuracy GPS adds roughly 3–6 %/hour. A `distanceFilter` of ~10 m
cuts callback churn. The free plugin has no motion-based pausing (the drive is always
moving, so moot). Measure over one ~45 min real drive with tracking on vs. a normal
logged drive.

## 10. Testing (real device)

1. Start a drive, background the app, drive a loop with Maps in front, foreground —
   route is continuous, no missing segment.
2. Lock the screen mid-drive (short) — fixes continue.
3. Kill the app mid-drive, relaunch — the resume/save prompt appears with the partial
   drive intact.
4. Android: the "Recording your drive" notification shows and updates; tapping it
   returns to the timer.
5. Battery drain over ~45 min.

## 11. Open questions

1. **Permission scope:** confirm the minimal path (iOS "When In Use" + background
   mode; Android FGS-from-tap, no `ACCESS_BACKGROUND_LOCATION`). Escalate to "Always"
   / background-location only if testing shows drives still drop.
2. **Plugin:** confirm `@capacitor-community/background-geolocation` (free) over the
   paid transistorsoft plugin.
3. **Process-kill UX:** silent checkpoint + "resume / save / discard" prompt on next
   launch — or accept best-effort and skip the recovery flow for v1?
4. **Linear:** file this as a sub-issue of DEV-70, or its own issue?

## 12. Rough effort

Medium. Plugin install + native config (Info.plist background mode, Android FGS
permissions + notification strings) + `geo.js` native path + incremental checkpoint /
resume flow + `DriveTimer` copy + `privacy-labels.md` update + store-review prep.
~1–2 focused sessions plus real-device iteration.
