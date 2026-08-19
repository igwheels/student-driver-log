import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { auth } from '../firebase';
import {
  sendPasswordResetEmail,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  GoogleAuthProvider,
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
} from 'firebase/auth';

const DELETE_PHRASE = 'Delete this account and all its dashboards forever.';

/**
 * Two-factor auth here uses Firebase's phone-based Multi-Factor Auth.
 * Requires, in the Firebase Console: the project on the Blaze (pay-as-you-go)
 * plan, Phone sign-in enabled (Authentication > Sign-in method), and
 * Multi-factor authentication turned on (Authentication > Settings).
 */
export default function Account() {
  const { user, students, deleteStudent, logout } = useApp();
  const navigate = useNavigate();

  const [resetStatus, setResetStatus] = useState('');

  const [enrolledFactors, setEnrolledFactors] = useState([]);
  const [phone, setPhone] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [code, setCode] = useState('');
  const [mfaStatus, setMfaStatus] = useState('');
  const [mfaError, setMfaError] = useState('');

  const [deleteInput, setDeleteInput] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');

  useEffect(() => {
    if (auth.currentUser) {
      setEnrolledFactors(multiFactor(auth.currentUser).enrolledFactors);
    }
  }, []);

  const handlePasswordReset = async () => {
    setResetStatus('');
    try {
      await sendPasswordResetEmail(auth, user.email);
      setResetStatus(`Password reset email sent to ${user.email}.`);
    } catch (e) {
      setResetStatus(e.message || 'Could not send reset email.');
    }
  };

  const handleSendCode = async () => {
    setMfaError('');
    setMfaStatus('');
    if (!auth.currentUser) return setMfaError('Your session has expired — please sign in again.');
    if (!phone.trim()) return setMfaError('Enter a phone number, e.g. +15551234567.');
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      }
      const session = await multiFactor(auth.currentUser).getSession();
      const phoneAuthProvider = new PhoneAuthProvider(auth);
      const id = await phoneAuthProvider.verifyPhoneNumber(
        { phoneNumber: phone.trim(), session },
        window.recaptchaVerifier
      );
      setVerificationId(id);
      setMfaStatus('Code sent — enter it below.');
    } catch (e) {
      setMfaError(e.message || 'Could not send verification code.');
    }
  };

  const handleVerifyCode = async () => {
    setMfaError('');
    try {
      const cred = PhoneAuthProvider.credential(verificationId, code.trim());
      const assertion = PhoneMultiFactorGenerator.assertion(cred);
      await multiFactor(auth.currentUser).enroll(assertion, 'Phone');
      setEnrolledFactors(multiFactor(auth.currentUser).enrolledFactors);
      setPhone('');
      setCode('');
      setVerificationId('');
      setMfaStatus('Two-factor authentication enabled.');
    } catch (e) {
      setMfaError(e.message || 'Could not verify that code.');
    }
  };

  const handleRemoveFactor = async (factor) => {
    setMfaError('');
    try {
      await multiFactor(auth.currentUser).unenroll(factor);
      setEnrolledFactors(multiFactor(auth.currentUser).enrolledFactors);
    } catch (e) {
      setMfaError(e.message || 'Could not remove that factor.');
    }
  };

  const performDeletion = async () => {
    const owned = students.filter((s) => s.ownerId === user.id);
    for (const s of owned) {
      await deleteStudent(s.id);
    }
    await deleteUser(auth.currentUser);
    logout();
    navigate('/');
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');
    if (deleteInput !== DELETE_PHRASE) return;
    setDeleting(true);
    try {
      await performDeletion();
    } catch (e) {
      if (e.code === 'auth/requires-recent-login') {
        setNeedsReauth(true);
      } else {
        setDeleteError(e.message || 'Could not delete account.');
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleReauthAndDelete = async () => {
    setDeleteError('');
    setDeleting(true);
    try {
      const providerId = auth.currentUser.providerData[0]?.providerId;
      if (providerId === 'google.com') {
        await reauthenticateWithPopup(auth.currentUser, new GoogleAuthProvider());
      } else {
        if (!reauthPassword) {
          setDeleteError('Enter your password to confirm.');
          setDeleting(false);
          return;
        }
        await reauthenticateWithCredential(
          auth.currentUser,
          EmailAuthProvider.credential(user.email, reauthPassword)
        );
      }
      await performDeletion();
    } catch (e) {
      setDeleteError(e.message || 'Could not re-authenticate.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page">
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>Account</h2>
      <p style={{ color: 'var(--muted)', marginBottom: 28 }}>{user?.email}</p>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, marginBottom: 10 }}>Password</h3>
        <button className="btn btn-outline" onClick={handlePasswordReset}>
          Send password reset email
        </button>
        {resetStatus && <p style={{ fontSize: 13, marginTop: 10, color: 'var(--muted)' }}>{resetStatus}</p>}
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, marginBottom: 10 }}>Two-factor authentication</h3>

        {enrolledFactors.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {enrolledFactors.map((f) => (
              <div
                key={f.uid}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}
              >
                <span>{f.displayName || f.phoneNumber || 'Phone'}</span>
                <button
                  className="btn btn-outline"
                  style={{ width: 'auto', padding: '6px 12px' }}
                  onClick={() => handleRemoveFactor(f)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {enrolledFactors.length === 0 && !verificationId && (
          <>
            <div className="field">
              <label>Phone number</label>
              <input
                type="tel"
                placeholder="+15551234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={handleSendCode}>
              Send verification code
            </button>
          </>
        )}

        {verificationId && (
          <>
            <div className="field">
              <label>Verification code</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
            </div>
            <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={handleVerifyCode}>
              Verify and enable
            </button>
          </>
        )}

        {mfaStatus && <p style={{ fontSize: 13, marginTop: 10, color: 'var(--success)' }}>{mfaStatus}</p>}
        {mfaError && <p style={{ fontSize: 13, marginTop: 10, color: 'var(--danger)' }}>{mfaError}</p>}
        <div id="recaptcha-container" />
      </section>

      <section style={{ borderTop: '1px solid var(--line)', paddingTop: 24 }}>
        <h3 style={{ fontSize: 16, marginBottom: 10, color: 'var(--danger)' }}>Delete account</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          This permanently deletes your account and every dashboard you own, including all logged
          drives. Dashboards owned by someone else that were shared with you aren't affected,
          though your email may stay listed on them until their owner removes it. This can't be
          undone.
        </p>

        {!needsReauth ? (
          <>
            <div className="field">
              <label>Type "{DELETE_PHRASE}" to confirm</label>
              <input value={deleteInput} onChange={(e) => setDeleteInput(e.target.value)} />
            </div>
            <button
              className="btn"
              style={{ marginTop: 12, background: 'var(--danger)', color: 'var(--white)' }}
              disabled={deleteInput !== DELETE_PHRASE || deleting}
              onClick={handleDeleteAccount}
            >
              {deleting ? 'Deleting…' : 'Delete account'}
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, marginBottom: 12 }}>
              For your security, please confirm your identity again before deleting your account.
            </p>
            {auth.currentUser?.providerData[0]?.providerId !== 'google.com' && (
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  value={reauthPassword}
                  onChange={(e) => setReauthPassword(e.target.value)}
                />
              </div>
            )}
            <button
              className="btn"
              style={{ marginTop: 12, background: 'var(--danger)', color: 'var(--white)' }}
              disabled={deleting}
              onClick={handleReauthAndDelete}
            >
              {deleting ? 'Deleting…' : 'Confirm and delete account'}
            </button>
          </>
        )}
        {deleteError && <p style={{ fontSize: 13, marginTop: 10, color: 'var(--danger)' }}>{deleteError}</p>}
      </section>
    </div>
  );
}
