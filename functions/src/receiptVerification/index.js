import { STORES } from '../constants.js';
import { verifyAppStoreReceipt } from './appStore.js';
import { verifyPlayReceipt } from './playStore.js';

// Single entry point validatePurchase.js calls — keeps it ignorant of which
// store it's talking to. Each verifier resolves to
// { transactionId, productId, environment } on success, or throws.
//
// Swapping in real Apple/Google verification later means only editing
// appStore.js / playStore.js; this dispatch and validatePurchase.js's
// replay/entitlement logic shouldn't need to change.
export async function verifyReceipt(store, payload) {
  switch (store) {
    case STORES.APP_STORE:
      return verifyAppStoreReceipt(payload);
    case STORES.PLAY_STORE:
      return verifyPlayReceipt(payload);
    default:
      throw new Error(`Unknown store: ${store}`);
  }
}
