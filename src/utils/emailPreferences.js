import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// One doc per email address (not per account) so the unsubscribe link in an
// email works without requiring the recipient to be signed in — the same
// preference is what the Account page checkbox reads and writes for a
// signed-in user's own email. No document for an email means subscribed
// (the default the first time an account is created).
const normalizeEmail = (email) => email.trim().toLowerCase();

export async function getWeeklyEmailOptOut(email) {
  const snap = await getDoc(doc(db, 'emailPreferences', normalizeEmail(email)));
  return snap.exists() && snap.data().weeklyEmailOptOut === true;
}

export async function setWeeklyEmailOptOut(email, optOut) {
  await setDoc(
    doc(db, 'emailPreferences', normalizeEmail(email)),
    { weeklyEmailOptOut: optOut, updatedAt: new Date().toISOString() },
    { merge: true }
  );
}
