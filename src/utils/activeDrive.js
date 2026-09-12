/**
 * A checkpoint of the drive currently being timed, so a mid-drive process
 * kill — the OS reclaiming memory behind a backgrounded app, a reboot, a
 * WebView crash — doesn't lose it. The live timer rewrites this every ~20 s;
 * DriveTimer clears it on End Drive, and the Dashboard offers to resume,
 * save, or discard whatever is left.
 *
 * localStorage (not sessionStorage like pendingDrive) because it has to
 * survive the app process dying.
 */

const KEY = 'sdl_active_drive';
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

// checkpoint: { startTime (ISO), startOffsetMinutes, miles, route, start,
// end, maxSpeedMph, safetyEventCounts }
export function saveActiveDrive(studentId, checkpoint) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ studentId, savedAt: Date.now(), ...checkpoint }));
  } catch (e) {
    // A drive that can't be checkpointed still records live — only the
    // process-kill safety net is lost. Not worth interrupting for.
    console.warn('Could not checkpoint the active drive:', e);
  }
}

export function readActiveDrive() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const cp = JSON.parse(raw);
    if (!cp?.savedAt || Date.now() - cp.savedAt > MAX_AGE_MS) {
      clearActiveDrive();
      return null;
    }
    return cp;
  } catch {
    return null;
  }
}

export function clearActiveDrive() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // An unwritable store is also an unreadable one — nothing to do.
  }
}
