import { Capacitor } from '@capacitor/core';
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { CapacitorPreferencesPersistence } from './utils/capacitorAuthPersistence';

const firebaseConfig = {
  apiKey: 'AIzaSyCkf0lYqIF-GK3Eg3WT0vyLe_si1VYyM4M',
  authDomain: 'student-driver-log-b1924.firebaseapp.com',
  projectId: 'student-driver-log-b1924',
  storageBucket: 'student-driver-log-b1924.firebasestorage.app',
  messagingSenderId: '829898988631',
  appId: '1:829898988631:web:cca7973251680529eb9712',
  // No measurementId on purpose: the app does not load firebase/analytics or
  // call getAnalytics(), so Google Analytics for Firebase never initializes.
  // Keeping the ID out of the config removes any chance of it being switched
  // on by accident and keeps the "no analytics" privacy claim unambiguous.
};

const app = initializeApp(firebaseConfig);
// Persistence is the whole reason auth is wired by hand on native.
//
// getAuth()'s auto-detection probes IndexedDB first, which hangs inside
// the Capacitor WKWebView (non-standard capacitor://localhost origin) —
// onAuthStateChanged then never fires and every RequireAuth route stays
// blank. browserLocalPersistence avoids that hang but has its own, subtler
// failure here: Firebase confirms localStorage works by waiting for a
// `storage` event, which only fires cross-context, so in a single web view
// the check times out and Firebase silently falls back to in-memory — the
// session is written to localStorage but never restored, so a full quit +
// relaunch signs the user out every time (see DEV-8 phase 4 debugging).
//
// So on native, persist through @capacitor/preferences (native
// UserDefaults / SharedPreferences) — no `storage` event, no IndexedDB, and
// it outlives app updates. browserLocalPersistence / indexedDBLocalPersistence
// stay in the list as ordered fallbacks and as migration sources, so a
// session already stored by the old config is carried over on first launch
// rather than dropped. Web keeps getAuth()'s normal fallback chain, which
// degrades gracefully when localStorage is restricted (Safari private mode).
// Preferences first; browserLocalPersistence second, only as a migration
// source for a session written by the previous config. indexedDBLocal
// persistence is deliberately NOT in the list — if Preferences ever failed
// its check, falling through to IndexedDB is the hang this whole dance
// exists to avoid.
export const auth = Capacitor.isNativePlatform()
  ? initializeAuth(app, {
      persistence: [CapacitorPreferencesPersistence, browserLocalPersistence],
    })
  : getAuth(app);
export const db = getFirestore(app);
// Default region (us-central1) matches functions/src/*.js's explicit
// `region: 'us-central1'` — no need to pass a region here too.
export const functions = getFunctions(app);
