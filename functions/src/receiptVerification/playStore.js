// Google Play purchase verification — STUB.
//
// Real implementation should call the Play Developer API's
// purchases.products.get (for a one-time product like Family Pack) via a
// service account with access to the Play Console project, using
// googleapis' androidpublisher client. That returns purchaseState,
// consumptionState, etc. — check purchaseState === 0 (purchased) and that
// the token hasn't already been acknowledged/consumed in a way that
// invalidates it.
//
// Until then this throws, which validatePurchase.js surfaces to the
// client as functions/unimplemented rather than silently granting
// entitlement.
//
// payload shape expected once implemented: { purchaseToken, packageName }
export async function verifyPlayReceipt(payload) {
  throw new Error('Play Store purchase verification is not implemented yet.');
}
