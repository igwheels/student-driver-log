import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { auth, db } from '../firebase';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

/**
 * AUTH WIRING NOTES
 * -----------------
 * Sign-in options:
 *  1. Email/password: use Firebase Authentication (signInWithEmailAndPassword)
 *  2. Google: use Firebase Authentication (signInWithPopup + GoogleAuthProvider)
 *  3. Apple Sign-In: available through Firebase's OAuthProvider('apple.com')
 *     but requires domain verification in your Apple Developer account
 */
export default function Login() {
  const { setUser } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const completeLogin = async (profile) => {
    setUser(profile);

    // Check for pending invitations
    try {
      const invitationsRef = collection(db, 'invitations');
      const q = query(invitationsRef, where('email', '==', profile.email), where('accepted', '==', false));
      const invitationsSnap = await getDocs(q);

      if (invitationsSnap.docs.length > 0) {
        console.log('Found pending invitations:', invitationsSnap.docs.length);

        // Mark invitations as accepted and grant access
        for (const invDoc of invitationsSnap.docs) {
          const inv = invDoc.data();
          await updateDoc(invDoc.ref, { accepted: true, acceptedAt: new Date().toISOString() });

          // Add user to the student's sharedWith if not already there
          const studentRef = doc(db, 'users', inv.ownerId, 'students', inv.studentId);
          const studentSnap = await getDocs(collection(db, 'users', inv.ownerId, 'students'));

          for (const studentDoc of studentSnap.docs) {
            if (studentDoc.id === inv.studentId) {
              const student = studentDoc.data();
              const sharedWith = student.sharedWith || [];

              if (!sharedWith.some(s => s.email === profile.email)) {
                sharedWith.push({ email: profile.email, addedAt: new Date().toISOString() });
                await updateDoc(studentRef, { sharedWith });
              }
              break;
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to process invitations:', e);
      // Don't block login on invitation processing failure
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
      const code = err.code || '';
      if (code.includes('user-not-found') || code.includes('invalid-credential') || code.includes('wrong-password')) {
        completeLogin({ id: 'local', name: email.split('@')[0], email: email.trim() });
      } else {
        setError(err.message || 'Sign-in failed. Check your email and password.');
      }
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      // Force Google to show account picker every time
      provider.setCustomParameters({ prompt: 'select_account' });
      const userCredential = await signInWithPopup(auth, provider);
      const { user } = userCredential;
      console.log('Google sign-in successful:', user.uid);
      completeLogin({
        id: user.uid,
        name: user.displayName || 'User',
        email: user.email,
      });
    } catch (err) {
      console.error('Google sign-in error:', err);
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
