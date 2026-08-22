import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { auth } from '../firebase';
import { requestLocationPermission } from '../utils/geo';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
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
  const [resetStatus, setResetStatus] = useState('');
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [resendStatus, setResendStatus] = useState('');

  const completeLogin = (profile) => {
    setUser(profile);
    // Prompt for location access now, so it's already resolved by the time
    // a drive timer needs live GPS to estimate mileage.
    requestLocationPermission();
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
        // and invited co-parents signing up for the first time). Require email
        // verification before the new account can sign in, so a bogus/typo'd
        // address can't be used to spin up accounts.
        try {
          const { user } = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
          await sendEmailVerification(user);
          await signOut(auth);
          setPendingVerificationEmail(trimmedEmail);
        } catch (createErr) {
          setError(createErr.message || 'Could not create an account with that email.');
        }
      } else {
        setError(err.message || 'Sign-in failed. Check your email and password.');
      }
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setResetStatus('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Enter your email above first, then tap "Forgot your password?".');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setResetStatus(`Password reset email sent to ${trimmedEmail}.`);
    } catch (err) {
      setError(err.message || 'Could not send reset email.');
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const customParams = { prompt: 'select_account' };
      // Arrived via a share invitation link — suggest that email in Google's
      // account picker so they're more likely to end up signed in with the
      // exact address the dashboard was shared with.
      if (email.trim()) customParams.login_hint = email.trim();
      provider.setCustomParameters(customParams);
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

  const handleResendVerification = async () => {
    setError('');
    setResendStatus('');
    try {
      // sendEmailVerification needs a live user session; sign back in briefly
      // with the credentials still in the form, then sign out again.
      const { user } = await signInWithEmailAndPassword(auth, pendingVerificationEmail, password);
      if (user.emailVerified) {
        // They verified since we last checked — just let them in.
        completeLogin({ id: user.uid, name: user.displayName || pendingVerificationEmail.split('@')[0], email: user.email });
        return;
      }
      await sendEmailVerification(user);
      await signOut(auth);
      setResendStatus(`Verification email resent to ${pendingVerificationEmail}.`);
    } catch (err) {
      setError(err.message || 'Could not resend the verification email.');
    }
  };

  const invitedEmail = searchParams.get('email');

  if (pendingVerificationEmail) {
    return (
      <div className="login-screen">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Student Driver Log" className="login-logo" />
        <h1 className="login-title">Check your email</h1>
        <p style={{ color: 'var(--muted)', textAlign: 'center', maxWidth: 340, marginTop: 8 }}>
          We sent a verification link to <strong>{pendingVerificationEmail}</strong>. Click it to finish
          creating your account, then come back here and sign in.
        </p>
        {error && <p style={{ color: '#F2A63C', fontSize: 13, marginTop: 12 }}>{error}</p>}
        {resendStatus && <p style={{ color: '#7FA8F0', fontSize: 13, marginTop: 12 }}>{resendStatus}</p>}
        <div style={{ width: '100%', maxWidth: 340, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn-primary" onClick={handleResendVerification}>Resend verification email</button>
          <button
            type="button"
            className="bio-link"
            onClick={() => {
              setPendingVerificationEmail('');
              setError('');
              setResendStatus('');
            }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

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
        {resetStatus && <p style={{ color: '#7FA8F0', fontSize: 13, marginBottom: 12 }}>{resetStatus}</p>}
        <button type="submit" className="btn btn-primary">Sign in</button>
        <button type="button" className="bio-link" onClick={handleForgotPassword}>
          Forgot your password?
        </button>
      </form>

      <div className="divider" style={{ width: '100%', maxWidth: 340 }}>or</div>

      <div style={{ width: '100%', maxWidth: 340 }}>
        <button className="btn btn-ghost" onClick={handleGoogleLogin}>Continue with Google</button>
        {invitedEmail && (
          <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 10, textAlign: 'center' }}>
            Use the Google account for {invitedEmail} to see the shared dashboard.
          </p>
        )}
      </div>
    </div>
  );
}
