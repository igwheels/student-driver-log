import { Capacitor } from '@capacitor/core';
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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
// getAuth()'s default persistence auto-detection probes IndexedDB first,
// which hangs indefinitely inside a Capacitor WKWebView (loaded from the
// non-standard capacitor://localhost origin) — the sign-in call itself
// succeeds, but onAuthStateChanged then never fires, so AppContext's
// authChecked flag never flips true and every RequireAuth-gated route stays
// blank forever. Forcing a single persistence type (browserLocalPersistence)
// skips that IndexedDB probe entirely, which is what native needs — but
// forcing it broke Safari, where initializeAuth() throws auth/argument-error
// if localStorage is restricted (private browsing, some PWA/ITP storage
// states), a case getAuth()'s normal fallback chain (IndexedDB → localStorage
// → sessionStorage → in-memory) handles gracefully. So this only applies to
// native, where the fallback chain is what hangs in the first place.
export const auth = Capacitor.isNativePlatform()
  ? initializeAuth(app, { persistence: browserLocalPersistence })
  : getAuth(app);
export const db = getFirestore(app);
