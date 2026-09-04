// App Store receipt/transaction verification — STUB.
//
// Real implementation should call Apple's App Store Server API
// (GET /inApps/v1/transactions/{transactionId} against
// api.storekit.itunes.apple.com, or api.storekit-sandbox.itunes.apple.com
// for sandbox purchases) using a signed JWT built from an App Store
// Connect API key (issuer id, key id, .p8 private key — none of which
// exist yet; see DEV-36/DEV-10, blocked on the Apple Developer account).
// That call returns a signed JWS transaction, which must be verified
// against Apple's root certs before trusting its contents (App Store
// Server Library, @apple/app-store-server-library, does this).
//
// Until then this throws, which validatePurchase.js surfaces to the
// client as functions/unimplemented rather than silently granting
// entitlement.
//
// payload shape expected once implemented: { transactionId, receiptData? }
// (StoreKit 2 uses signed transactions, not the old base64 receipt blob —
// confirm which the chosen Capacitor IAP plugin exposes before wiring this
// up, since it changes what `payload` needs to carry.)
export async function verifyAppStoreReceipt(payload) {
  throw new Error('App Store receipt verification is not implemented yet (needs an Apple Developer account).');
}
