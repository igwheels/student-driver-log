import React, { useState } from 'react';
import {
  authenticateWithBiometrics,
  setBiometricEnabledForUser,
  markBiometricEnrollmentAsked,
} from '../utils/biometricAuth';

/**
 * Shown once, right after a fresh interactive sign-in on native, offering
 * to enable biometric unlock — DEV-28's "offer to enable it after first
 * sign-in." AppContext decides WHEN this should render (device has
 * biometrics available, this account hasn't been asked before); this
 * component only handles the accept/decline choice itself.
 *
 * "Enable" actually runs a real authenticate() before flipping the
 * preference on, rather than trusting the tap alone — so a device that
 * reports biometrics as available but then fails outright (a plugin/OS
 * quirk) doesn't get silently marked "enabled" and start locking someone
 * out on the very next open.
 */
export default function BiometricEnrollPrompt({ uid, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const finish = (enabled) => {
    markBiometricEnrollmentAsked(uid);
    setBiometricEnabledForUser(uid, enabled);
    onDone();
  };

  const handleEnable = async () => {
    setBusy(true);
    setError('');
    const result = await authenticateWithBiometrics('Confirm to enable Face ID / Touch ID unlock');
    setBusy(false);
    if (result.ok) {
      finish(true);
      return;
    }
    if (result.code === 'userCancel') {
      // Not an error — they just backed out of confirming. Leave the
      // prompt up rather than treating a cancel as a decline.
      return;
    }
    setError("Couldn't confirm biometric unlock on this device — you can try again later from Account.");
  };

  const handleNotNow = () => finish(false);

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : handleNotNow}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-text">Unlock with Face ID or Touch ID next time, instead of typing your password?</div>
        {error && <p style={{ color: '#D8503F', fontSize: 13, marginTop: 12 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={handleNotNow} disabled={busy}>
            Not now
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleEnable} disabled={busy}>
            {busy ? 'Confirming…' : 'Enable'}
          </button>
        </div>
      </div>
    </div>
  );
}
