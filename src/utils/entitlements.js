// Client side of the Family Pack entitlement model. See
// functions/src/validatePurchase.js and firestore.rules for the trusted
// half — this file never grants entitlement itself, it only reads what the
// server already decided, plus the callable wrapper for when a purchase
// actually happens.
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, functions } from '../firebase';

// Mirrors functions/src/constants.js — see the note there on why these
// aren't imported directly (the functions codebase deploys independently).
const ENTITLEMENTS_SUBCOLLECTION = 'entitlements';
const FAMILY_PACK_ENTITLEMENT_ID = 'familyPack';
export const FAMILY_PACK_PRODUCT_ID = 'family_pack_lifetime';

// Live-subscribes to the signed-in user's OWN entitlement doc. Used for
// gates on actions the account owner performs (adding another student,
// sharing with another supervisor) — see the DEV-36 report for why those
// are different from gates on a shared student's features, which read
// `familyPackActive` off the student document instead (see
// studentHasFamilyPack below).
export function watchOwnFamilyPack(uid, callback) {
  if (!uid) {
    callback(false);
    return () => {};
  }
  const ref = doc(db, 'users', uid, ENTITLEMENTS_SUBCOLLECTION, FAMILY_PACK_ENTITLEMENT_ID);
  return onSnapshot(
    ref,
    (snap) => callback(Boolean(snap.data()?.active)),
    () => callback(false)
  );
}

// Whether a given student's OWNING household has Family Pack — this is
// what a shared co-parent's gates should check for features on that
// student (CSV export, telematics trends, custom reminders), rather than
// their own entitlement. Reads the flag functions/src/entitlementFanout.js
// denormalizes onto the student document, which the current viewer already
// has read access to (owner or shared, per firestore.rules).
//
// NOTE: like the rest of AppContext's student list, this reflects whatever
// was loaded on the last fetch, not a live subscription — a purchase made
// in another tab won't flip this until students are reloaded (matches the
// existing one-time getDocs() pattern in AppContext.jsx, not a new
// limitation introduced here).
export function studentHasFamilyPack(student) {
  return Boolean(student?.familyPackActive);
}

// Sends a verified receipt/transaction to validatePurchase. Used both right
// after a purchase completes and for Apple's required "Restore Purchases"
// flow — a restore just redelivers the same transaction, which lands on
// the idempotent branch in functions/src/validatePurchase.js.
//
// Not called from anywhere yet: there's no IAP plugin wired up to produce
// `receiptPayload`/`transactionId` (DEV-36's store integration, blocked on
// Apple/Google developer accounts) and no purchase UI to call it from
// (DEV-37). This exists so that work has a trusted endpoint to call into
// once it lands, without touching functions/ again.
export async function validatePurchase({ store, productId, transactionId, receiptPayload }) {
  const call = httpsCallable(functions, 'validatePurchase');
  const result = await call({ store, productId, transactionId, receiptPayload });
  return result.data;
}

// Placeholder for the "Restore Purchases" button Apple requires be
// somewhere in the app. Not wired to a real receipt source yet — see the
// note on validatePurchase above. Kept as a distinct named export so
// DEV-37's UI has one obvious thing to call rather than needing to know
// about validatePurchase's request shape.
export async function restorePurchases() {
  throw new Error(
    'restorePurchases is not implemented yet — needs a Capacitor IAP plugin to supply the transaction to restore.'
  );
}
