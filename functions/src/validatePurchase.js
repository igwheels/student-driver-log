import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  ENTITLEMENTS_SUBCOLLECTION,
  FAMILY_PACK_ENTITLEMENT_ID,
  FAMILY_PACK_PRODUCT_ID,
  RECEIPTS_COLLECTION,
  STORES,
} from './constants.js';
import { verifyReceipt } from './receiptVerification/index.js';

// The trusted write path for Family Pack entitlement. This is the ONLY
// place `users/{uid}/entitlements/*` is ever written — firestore.rules
// denies client writes to that subcollection outright, so the only way a
// document lands there is via this function's Admin SDK access, after a
// receipt has actually verified. A client that just flips local state
// (or writes Firestore directly) can't grant itself the entitlement.
//
// Called with `onCall`, not a raw HTTPS endpoint: the Firebase client SDK
// attaches the caller's ID token, and the platform verifies it BEFORE this
// code runs — `request.auth.uid` here is the real signed-in uid, not
// something the client can pass in and lie about. That verified uid is
// exactly what makes "a purchase can't be spoofed" true: the entitlement
// always gets attached to whoever is actually signed in when the receipt
// validates, never to a uid supplied in the request body.
//
// Also serves as "restore purchases" — Apple/Google's restore flow just
// redelivers the same transaction/receipt for a non-consumable, which
// lands here again and hits the idempotent branch below. No separate
// function needed; see src/utils/entitlements.js on the client.
export const validatePurchase = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in before validating a purchase.');
  }
  const uid = request.auth.uid;

  const { store, productId, transactionId, receiptPayload } = request.data || {};
  if (!Object.values(STORES).includes(store)) {
    throw new HttpsError('invalid-argument', `store must be one of ${Object.values(STORES).join(', ')}`);
  }
  if (typeof productId !== 'string' || !productId) {
    throw new HttpsError('invalid-argument', 'productId is required.');
  }
  if (typeof transactionId !== 'string' || !transactionId) {
    throw new HttpsError('invalid-argument', 'transactionId is required.');
  }
  // Only one product exists today. Reject anything else early rather than
  // grant entitlement for a productId nobody defined.
  if (productId !== FAMILY_PACK_PRODUCT_ID) {
    throw new HttpsError('invalid-argument', `Unrecognized productId: ${productId}`);
  }

  // Verifies against the store's own servers — see receiptVerification/.
  // Both verifiers are stubs today (blocked on developer-account access);
  // this throws functions/internal until one is implemented, which is
  // correct: better to fail loudly than to fall through and grant
  // entitlement on an unverified receipt.
  let verified;
  try {
    verified = await verifyReceipt(store, receiptPayload ?? { transactionId });
  } catch (e) {
    throw new HttpsError('unimplemented', e.message);
  }

  const db = getFirestore();
  // Keyed by store + the store's own transaction id, not by our own
  // generated id — that's what makes a resubmitted receipt (retry, or a
  // second account attempting to replay someone else's purchase) land on
  // the SAME document instead of creating a new one.
  const receiptId = `${store}:${verified.transactionId || transactionId}`;
  const receiptRef = db.collection(RECEIPTS_COLLECTION).doc(receiptId);
  const entitlementRef = db
    .collection('users')
    .doc(uid)
    .collection(ENTITLEMENTS_SUBCOLLECTION)
    .doc(FAMILY_PACK_ENTITLEMENT_ID);

  // Transaction so the "does this receipt already exist" check and the
  // writes that follow it are atomic — without it, two concurrent calls
  // validating the same receipt (a retry racing the original, or a replay
  // attempt) could both read "doesn't exist yet" and both proceed.
  await db.runTransaction(async (txn) => {
    const existing = await txn.get(receiptRef);
    if (existing.exists) {
      const existingUid = existing.data().uid;
      if (existingUid !== uid) {
        // This exact transaction was already claimed by a different
        // account. Refuse rather than silently re-granting — this is the
        // core anti-spoofing/anti-sharing check.
        throw new HttpsError(
          'already-exists',
          'This purchase has already been redeemed by a different account.'
        );
      }
      // Same account re-submitting the same receipt (retry, or an actual
      // "restore purchases" call) — idempotent, just re-affirm entitlement
      // in case a previous attempt failed partway through.
      txn.set(
        entitlementRef,
        {
          active: true,
          productId,
          store,
          environment: verified.environment ?? null,
          transactionId: verified.transactionId || transactionId,
          purchasedAt: existing.data().validatedAt ?? FieldValue.serverTimestamp(),
          validatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    txn.set(receiptRef, {
      uid,
      store,
      productId,
      transactionId: verified.transactionId || transactionId,
      environment: verified.environment ?? null,
      validatedAt: FieldValue.serverTimestamp(),
    });
    txn.set(entitlementRef, {
      active: true,
      productId,
      store,
      environment: verified.environment ?? null,
      transactionId: verified.transactionId || transactionId,
      purchasedAt: FieldValue.serverTimestamp(),
      validatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { active: true };
});
