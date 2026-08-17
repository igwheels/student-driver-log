/**
 * WebAuthn-based biometric unlock (Face ID / Touch ID / Windows Hello via
 * the browser's platform authenticator).
 *
 * IMPORTANT: a production WebAuthn flow needs a server to generate and
 * verify challenges and to store public keys against a user record —
 * that's what actually makes it secure. This client-only version is a
 * working demo: it creates a platform-authenticator credential and treats
 * a successful assertion as "unlocked," storing the profile locally rather
 * than server-side. Swap in a real relying-party backend (or a library
 * like SimpleWebAuthn) before shipping.
 */

const CRED_ID_KEY = 'sdl_webauthn_cred_id';
const PROFILE_KEY = 'sdl_webauthn_profile';

export function isWebAuthnSupported() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
}

function randomBytes(len) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return arr;
}

export async function registerBiometric(profile) {
  const challenge = randomBytes(32);
  const userId = randomBytes(16);

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Student Driver Log' },
      user: { id: userId, name: profile.email || 'parent', displayName: profile.name || 'Parent' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60000,
    },
  });

  localStorage.setItem(CRED_ID_KEY, credential.id);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return credential;
}

export function hasBiometricEnrolled() {
  return !!localStorage.getItem(CRED_ID_KEY);
}

export async function authenticateBiometric() {
  const credId = localStorage.getItem(CRED_ID_KEY);
  if (!credId) throw new Error('No biometric credential enrolled on this device.');

  const challenge = randomBytes(32);
  await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ id: Uint8Array.from(atob(credId.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)), type: 'public-key' }],
      userVerification: 'required',
      timeout: 60000,
    },
  }).catch(() => {
    // Some browsers base64-encode differently; fall back to a plain prompt
    // if decoding the stored credential id fails. Re-registering resolves this.
    throw new Error('Biometric verification failed or was cancelled.');
  });

  const raw = localStorage.getItem(PROFILE_KEY);
  return raw ? JSON.parse(raw) : null;
}
