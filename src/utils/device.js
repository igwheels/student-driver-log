export function getSharePlatform() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const platform = typeof navigator !== 'undefined' ? navigator.platform || '' : '';

  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (platform === 'MacIntel' && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);

  if (isIOS) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

/**
 * Keeps the screen from auto-locking via the Wake Lock API, for as long as
 * the page stays foregrounded — this does NOT keep GPS tracking running
 * once the app is backgrounded, switched away from, or the screen is
 * locked manually; browsers suspend page JavaScript at that point
 * regardless (most aggressively on iOS Safari). It only prevents the
 * phone's own idle-timeout from locking the screen while the page is
 * actively in front of the driver. Returns a release() function.
 */
export function keepScreenAwake() {
  if (!('wakeLock' in navigator)) return () => {};

  let sentinel = null;
  let released = false;

  const acquire = async () => {
    try {
      sentinel = await navigator.wakeLock.request('screen');
    } catch {
      // Can fail if the tab isn't visible, battery saver is on, etc. —
      // nothing to do but leave the screen's own timeout in place.
    }
  };

  acquire();

  // A wake lock is automatically released whenever the page is hidden
  // (tab switched, backgrounded, screen locked) and must be re-requested
  // once it becomes visible again, or it silently stays off forever.
  const onVisibilityChange = () => {
    if (!released && document.visibilityState === 'visible') acquire();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    released = true;
    document.removeEventListener('visibilitychange', onVisibilityChange);
    sentinel?.release().catch(() => {});
  };
}
