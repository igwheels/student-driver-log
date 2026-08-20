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
