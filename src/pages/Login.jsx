import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { auth } from '../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';

/**
 * AUTH WIRING NOTES
 * -----------------
 * Sign-in options:
 *  1. Email/password: signInWithEmailAndPassword, falling back to
 *     createUserWithEmailAndPassword the first time (so first-time visitors,
 *     including invited co-parents, get a real Firebase account and uid).
 *  2. Google: signInWithPopup + GoogleAuthProvider.
 *  3. Apple Sign-In: available through Firebase's OAuthProvider('apple.com')
 *     but requires domain verification in your Apple Developer account.
 *
 * Sharing a student takes effect the moment the recipient is signed in with
 * the email it was shared with — see src/context/AppContext.jsx.
 */
export default function Login() {
  const { setUser } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const completeLogin = (profile) => {
    setUser(profile);
    navigate('/students');
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    const trimmedEmail = email.trim();
    try {
      const { user } = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      completeLogin({ id: user.uid, name: user.displayName || trimmedEmail.split('@')[0], email: user.email });
    } catch (err) {
      const code = err.code || '';
      if (code.includes('user-not-found') || code.includes('invalid-credential')) {
        // No account yet for this email — create one (covers first-time visitors
        // and invited co-parents signing up for the first time).
        try {
          const { user } = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
          completeLogin({ id: user.uid, name: trimmedEmail.split('@')[0], email: user.email });
        } catch (createErr) {
          setError(createErr.message || 'Could not create an account with that email.');
        }
      } else {
        setError(err.message || 'Sign-in failed. Check your email and password.');
      }
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const { user } = await signInWithPopup(auth, provider);
      completeLogin({ id: user.uid, name: user.displayName || 'User', email: user.email });
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled.');
      } else {
        setError(err.message || 'Google sign-in failed.');
      }
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
    </div>
  );
}
