// Shared "share this" action used by both the topbar ShareButton and any
// other share-style buttons (e.g. "Brag on your student"). Uses the native
// share sheet when available, falling back to copying the link with an
// onCopied callback the caller can use to show a toast.
export async function shareContent({ title, text, url }, { onCopied } = {}) {
  const shareUrl = url || window.location.href;
  const shareData = { title: title || document.title, text, url: shareUrl };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(shareUrl);
    onCopied?.();
  } catch (err) {
    console.error('Copy to clipboard failed:', err);
  }
}
