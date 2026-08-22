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
} from 'firebase/auth';
import { watchLocationPermissionStatus, requestLocationPermission } from '../utils/geo';
import {
  getWeeklyEmailOptOut,
  setWeeklyEmailOptOut,
  deleteWeeklyEmailPreference,
} from '../utils/emailPreferences';

const DELETE_PHRASE = 'Delete this account and all its dashboards forever.';

const LOCATION_STATUS_INFO = {
  granted: { label: 'Allowed', color: 'var(--success)', hint: 'Drive mileage will be estimated from GPS.' },
  denied: {
    label: 'Blocked',
    color: 'var(--danger)',
    hint: 'Mileage won’t auto-fill. Allow location for this site in your browser settings to re-enable it.',
  },
  prompt: { label: 'Not yet asked', color: 'var(--muted)', hint: 'You’ll be asked to allow it below.' },
  unsupported: { label: 'Unavailable', color: 'var(--muted)', hint: 'This browser doesn’t support checking location permission status.' },
};

export default function Account() {
  const { user, students, deleteStudent, logout } = useApp();
  const navigate = useNavigate();

  const [resetStatus, setResetStatus] = useState('');

  const [locationStatus, setLocationStatus] = useState(null);
  useEffect(() => watchLocationPermissionStatus(setLocationStatus), []);

  // No document for this email means subscribed by default — matches the
  // weekly-email sender's own default, so a brand-new account starts opted in.
  const [weeklyEmailOptIn, setWeeklyEmailOptIn] = useState(true);
  useEffect(() => {
    if (!user?.email) return;
    getWeeklyEmailOptOut(user.email).then((optedOut) => setWeeklyEmailOptIn(!optedOut));
  }, [user?.email]);

  const handleWeeklyEmailToggle = async (e) => {
    const checked = e.target.checked;
    setWeeklyEmailOptIn(checked);
    try {
      await setWeeklyEmailOptOut(user.email, !checked);
    } catch (err) {
      console.error('Failed to update email preference:', err);
      setWeeklyEmailOptIn(!checked);
    }
  };

  const [deleteInput, setDeleteInput] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');

  const handlePasswordReset = async () => {
    setResetStatus('');
    try {
      await sendPasswordResetEmail(auth, user.email);
      setResetStatus(`Password reset email sent to ${user.email}.`);
    } catch (e) {
      setResetStatus(e.message || 'Could not send reset email.');
    }
  };

  const performDeletion = async () => {
    const owned = students.filter((s) => s.ownerId === user.id);
    for (const s of owned) {
      // Also clears each student's directory entry, access requests, and
      // queued invitations — see deleteStudent in AppContext.jsx.
      await deleteStudent(s.id);
    }

    // The preference document is keyed by the email address itself, so
    // leaving it would keep that address on file after the account is gone.
    // Not fatal: the account deletion below matters more than this record.
    try {
      await deleteWeeklyEmailPreference(user.email);
    } catch (e) {
      console.warn('Failed to remove email preference:', e);
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

      <section style={{ borderTop: '1px solid var(--line)', paddingTop: 24, marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, marginBottom: 10 }}>Location access</h3>
        {!locationStatus && (
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>Checking…</p>
        )}
        {locationStatus && (
          <>
            <p style={{ fontSize: 14, marginBottom: 4 }}>
              Status:{' '}
              <span style={{ fontWeight: 700, color: LOCATION_STATUS_INFO[locationStatus].color }}>
                {LOCATION_STATUS_INFO[locationStatus].label}
              </span>
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              {LOCATION_STATUS_INFO[locationStatus].hint}
            </p>
            {locationStatus === 'prompt' && (
              <button className="btn btn-outline" onClick={requestLocationPermission}>
                Allow location access
              </button>
            )}
          </>
        )}
      </section>

      <section style={{ borderTop: '1px solid var(--line)', paddingTop: 24, marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, marginBottom: 10 }}>Email preferences</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={weeklyEmailOptIn} onChange={handleWeeklyEmailToggle} />
          Send me weekly progress emails
        </label>
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

      {/* Which build this device is actually running. Phones cache the app
          shell aggressively, and without this the only way to tell a stale
          copy from a broken feature is to reason backwards from the UI. */}
      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 32, textAlign: 'center' }}>
        Build {__BUILD_ID__}
      </p>
    </div>
  );
}
