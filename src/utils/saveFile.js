import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Saves a Blob for the user, choosing the mechanism that actually works on
 * the current platform.
 *
 * On the web, a synthetic <a download> click triggers the browser's normal
 * download flow. Inside a Capacitor native shell that trick is a dead end —
 * there's no download manager to catch it, so the click silently does
 * nothing — so instead this writes the file to the app's cache directory via
 * @capacitor/filesystem and hands it to the OS share sheet via
 * @capacitor/share, letting the user save it to Files, AirDrop it, email it,
 * etc.
 */
export async function saveOrShareBlob(blob, filename) {
  if (Capacitor.isNativePlatform()) {
    const base64Data = await blobToBase64(blob);
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Cache,
    });
    await Share.share({ title: filename, url: uri });
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
