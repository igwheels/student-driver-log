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
import { watchLocationPermissionStatus, requestLocationPermission, probeLocationAccess } from '../utils/geo';
import {
  getWeeklyEmailOptOut,
  setWeeklyEmailOptOut,
  deleteWeeklyEmailPreference,
} from '../utils/emailPreferences';

const DELETE_PHRASE = 'Delete this account and all its dashboards forever.';

// What the browser's permission registry says. This is only ever a hint: it
// reports the *site's* permission and is blind to the device refusing at the
// OS level, so 'granted' does not mean location actually works. The probe
// below is what settles it.
const LOCATION_STATUS_INFO = {
  granted: { label: 'Allowed for this site', color: 'var(--muted)', hint: 'Checking whether your device actually provides a location…' },
  denied: {
    label: 'Blocked',
    color: 'var(--danger)',
    hint: 'Mileage won’t auto-fill. Allow location for this site in your browser settings to re-enable it.',
  },
  prompt: { label: 'Not yet asked', color: 'var(--muted)', hint: 'You’ll be asked to allow it below.' },
  unsupported: { label: 'Unknown', color: 'var(--muted)', hint: 'This browser can’t report permission status — check it directly instead.' },
};

// What actually happened when a position was requested. Authoritative.
const LOCATION_PROBE_INFO = {
  working: { label: 'Working', color: 'var(--success)', hint: 'Drive mileage will be estimated from GPS.' },
  imprecise: {
    label: 'Too imprecise',
    color: 'var(--danger)',
    hint: 'Location is on, but the readings are too coarse to measure a drive. Turn on precise location for this site — on iOS that’s Settings › Privacy & Security › Location Services › Safari Websites › Precise Location.',
  },
  denied: {
    label: 'Blocked',
    color: 'var(--danger)',
    // The case that prompted this: the site permission read as allowed while
    // the device refused, and the page reported it as working.
    hint: 'Your device refused to provide a location. Check both this site’s permission and your device’s location settings — on iOS that’s Settings › Privacy & Security › Location Services, and the Safari Websites entry within it.',
  },
  unavailable: {
    label: 'No signal',
    color: 'var(--danger)',
    hint: 'Your device couldn’t determine a position. This is common indoors or in a garage.',
  },
  timeout: {
    label: 'No response',
    color: 'var(--danger)',
    hint: 'Your device didn’t return a position in time. Try again, ideally outdoors.',
  },
  unsupported: { label: 'Not supported', color: 'var(--muted)', hint: 'This browser doesn’t provide location at all.' },
};

export default function Account() {
  const { user, students, deleteStudent, logout } = useApp();
  const navigate = useNavigate();

  const [resetStatus, setResetStatus] = useState('');

  const [locationStatus, setLocationStatus] = useState(null);
  useEffect(() => watchLocationPermissionStatus(setLocationStatus), []);

  const [probe, setProbe] = useState(null);
  const [probing, setProbing] = useState(false);

  const runProbe = () => {
    setProbing(true);
    probeLocationAccess()
      .then(setProbe)
      .finally(() => setProbing(false));
  };

  // Probe automatically only when the site permission already says granted —
  // that's the case where the answer can be wrong, and asking costs no prompt
  // because permission is already held. When the state is 'prompt' or
  // 'denied', probing would either raise a surprise permission dialog or tell
  // us nothing new, so it's left to the buttons below.
  useEffect(() => {
    if (locationStatus === 'granted') runProbe();
    else setProbe(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationStatus]);

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
        {locationStatus && (() => {
          // The probe wins wherever it has run: it reflects what the device
          // actually did, while the permission state only reflects what this
          // site was granted.
          const info = probe
            ? LOCATION_PROBE_INFO[probe.state] ?? LOCATION_STATUS_INFO.unsupported
            : LOCATION_STATUS_INFO[locationStatus];
          const showCheckButton =
            !probing && (locationStatus === 'unsupported' || (probe && probe.state !== 'working'));

          return (
            <>
              <p style={{ fontSize: 14, marginBottom: 4 }}>
                Status:{' '}
                <span style={{ fontWeight: 700, color: info.color }}>
                  {probing ? 'Checking…' : info.label}
                </span>
                {probe?.state === 'imprecise' && probe.accuracy != null && (
                  <span style={{ color: 'var(--muted)' }}> (±{Math.round(probe.accuracy)} m)</span>
                )}
              </p>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>{info.hint}</p>

              {probe?.message && (
                <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, opacity: 0.8 }}>
                  Reported by your browser: {probe.message}
                  {probe.code != null ? ` (code ${probe.code})` : ''}
                </p>
              )}

              {locationStatus === 'prompt' && (
                <button className="btn btn-outline" onClick={requestLocationPermission}>
                  Allow location access
                </button>
              )}
              {showCheckButton && (
                <button className="btn btn-outline" onClick={runProbe}>
                  Check again
                </button>
              )}
            </>
          );
        })()}
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
