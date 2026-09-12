import { Preferences } from '@capacitor/preferences';

/**
 * A Firebase Auth persistence backed by @capacitor/preferences — native
 * UserDefaults on iOS, SharedPreferences on Android.
 *
 * Why not browserLocalPersistence: in the Capacitor WKWebView served from
 * capacitor://localhost, Firebase's localStorage-availability check waits
 * for a `storage` event to confirm the write landed. That event only
 * fires cross-context, and a Capacitor app is a single web view with no
 * other tabs, so the check times out, Firebase decides localStorage is
 * unusable, and silently falls back to in-memory persistence. The
 * firebase:authUser:* key is still written to localStorage, but it is
 * never read back on the next cold start — so the user is signed out
 * every time the app is fully quit and relaunched (backgrounding is fine
 * because the in-memory session survives). indexedDBLocalPersistence has
 * its own WKWebView reliability problems. Native key/value storage has
 * neither, and it also survives app updates.
 *
 * Firebase constructs this once via `new` (see _getInstance in
 * @firebase/auth) and drives it through the underscore-prefixed methods
 * below — the internal PersistenceInternal contract, stable across the
 * v9–v11 modular SDK. `_shouldAllowMigration` lets Firebase copy an
 * existing session in from another persistence listed alongside this one
 * (browserLocalPersistence) on first launch, so adopting this store
 * doesn't sign everyone out once.
 */

export class CapacitorPreferencesPersistence {
  constructor() {
    this.type = 'LOCAL';
    this._shouldAllowMigration = true;
  }

  // Deliberately NOT a bridge round-trip. This class is only ever put in
  // the persistence list on native (see src/firebase.js), where
  // @capacitor/preferences is in the build; probing the bridge here just
  // risks losing a startup race and making Firebase fall through to a
  // worse persistence. The real set/get calls below tolerate a
  // still-warming bridge with one retry.
  async _isAvailable() {
    return true;
  }

  async _withRetry(op) {
    const delays = [0, 150, 400, 800, 1500];
    let lastErr;
    for (let i = 0; i < delays.length; i += 1) {
      if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
      try {
        return await op();
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }

  async _set(key, value) {
    await this._withRetry(() => Preferences.set({ key, value: JSON.stringify(value) }));
  }

  async _get(key) {
    const { value } = await this._withRetry(() => Preferences.get({ key }));
    if (value == null) return null;
    try {
      return JSON.parse(value);
    } catch (e) {
      return null;
    }
  }

  async _remove(key) {
    await this._withRetry(() => Preferences.remove({ key }));
  }

  // A single WebView has no cross-context storage events, so there is
  // nothing to notify and nothing to listen for.
  _addListener(_key, _listener) {}
  _removeListener(_key, _listener) {}
}
