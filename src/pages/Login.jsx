import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  isWebAuthnSupported, registerBiometric, hasBiometricEnrolled, authenticateBiometric,
} from '../utils/webauthn';
import { auth } from '../firebase';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';

/**
 * AUTH WIRING NOTES
 * -----------------
 * Sign-in is stubbed for local development. To go to production:
 *  1. Email/password + Google: use Firebase Authentication
 *     (signInWithEmailAndPassword / signInWithPopup + GoogleAuthProvider).
 *  2. Apple Sign-In on web works through Firebase's OAuthProvider('apple.com')
 *     but requires domain verification in your Apple Developer account —
 *     add an "Continue with Apple" button the same way as Google once that's set up.
 *  3. Biometrics (WebAuthn) gate a *stored session* — see src/utils/webauthn.js
 *     for the production caveats (needs a relying-party server).
 */
export default function Login() {
  const { setUser } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bioReady, setBioReady] = useState(false);
  const [bioEnrolled, setBioEnrolled] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setBioReady(isWebAuthnSupported());
    setBioEnrolled(hasBiometricEnrolled());
  }, []);

  const completeLogin = async (profile) => {
    setUser(profile);
    if (bioReady && !bioEnrolled) {
      const wantsBio = window.confirm(
        'Use Face ID, Touch ID, or Windows Hello to unlock this app on this device next time?'
      );
      if (wantsBio) {
        try {
          await registerBiometric(profile);
        } catch (e) {
          console.warn('Biometric registration failed', e);
        }
      }
    }
    navigate('/students');
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const { user } = userCredential;
      completeLogin({
        id: user.uid,
        name: user.displayName || email.split('@')[0],
        email: user.email,
      });
    } catch (err) {
      setError(err.message || 'Sign-in failed. Check your email and password.');
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const { user } = userCredential;
      completeLogin({
        id: user.uid,
        name: user.displayName || 'User',
        email: user.email,
      });
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled.');
      } else {
        setError(err.message || 'Google sign-in failed.');
      }
    }
  };

  const handleBiometricUnlock = async () => {
    try {
      const profile = await authenticateBiometric();
      if (profile) {
        setUser(profile);
        navigate('/students');
      }
    } catch (e) {
      setError(e.message || 'Biometric sign-in failed.');
    }
  };

  return (
    <div className="login-screen">
      <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Student Driver Log" className="login-logo" />
      <h1 className="login-title">Student Driver Log</h1>

      <form className="login-form" onSubmit={handleEmailLogin}>
        <input
          type="email" placeholder="Email" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password" placeholder="Password" autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p style={{ color: '#F2A63C', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button type="submit" className="btn btn-primary">Sign in</button>
      </form>

      <div className="divider" style={{ width: '100%', maxWidth: 340 }}>or</div>

      <div style={{ width: '100%', maxWidth: 340 }}>
        <button className="btn btn-ghost" onClick={handleGoogleLogin}>Continue with Google</button>
      </div>

      {bioReady && bioEnrolled && (
        <button className="bio-link" onClick={handleBiometricUnlock}>
          Unlock with Face ID / Touch ID / Windows Hello
        </button>
      )}
    </div>
  );
}
