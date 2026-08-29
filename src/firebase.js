import { initializeApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCkf0lYqIF-GK3Eg3WT0vyLe_si1VYyM4M',
  authDomain: 'student-driver-log-b1924.firebaseapp.com',
  projectId: 'student-driver-log-b1924',
  storageBucket: 'student-driver-log-b1924.firebasestorage.app',
  messagingSenderId: '829898988631',
  appId: '1:829898988631:web:cca7973251680529eb9712',
  measurementId: 'G-NYHC3QJ5CN',
};

const app = initializeApp(firebaseConfig);
// getAuth()'s default persistence auto-detection probes IndexedDB first,
// which hangs indefinitely inside a Capacitor WKWebView (loaded from the
// non-standard capacitor://localhost origin) — the sign-in call itself
// succeeds, but onAuthStateChanged then never fires, so AppContext's
// authChecked flag never flips true and every RequireAuth-gated route stays
// blank forever. Forcing browserLocalPersistence (localStorage) skips that
// IndexedDB probe entirely; it's supported everywhere this app runs (web and
// both native WebViews) and this app's storage needs don't benefit from
// IndexedDB's extra capacity.
export const auth = initializeAuth(app, { persistence: browserLocalPersistence });
export const db = getFirestore(app);
