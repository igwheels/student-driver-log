/**
 * Carries a finished timed drive's GPS results from the timer to the log
 * form.
 *
 * These used to travel only as react-router navigation state, which lives in
 * the history entry and does not survive a page reload — and phone browsers
 * reload backgrounded tabs routinely, so stepping away between "End Drive"
 * and "Save" silently dropped the distance, the start/end points and the
 * route. The saved drive then had no mileage and no map, with nothing having
 * looked wrong on the form.
 *
 * sessionStorage survives that reload (it is scoped to the tab, not the
 * document), so it backs up the navigation state. Three guards keep a
 * leftover entry from attaching itself to an unrelated drive:
 *
 *   - the log form only looks here when the URL carries ?pending=1, which the
 *     timer sets and a manually-started "Log a Drive" does not;
 *   - the entry records which student it belongs to;
 *   - and when it was stored, so an abandoned one ages out.
 */

const KEY = 'sdl_pending_drive';
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function savePendingDrive(studentId, prefill) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ studentId, prefill, savedAt: Date.now() }));
  } catch (e) {
    // Not fatal — navigation state still carries the prefill unless the page
    // reloads, which is the only case this backup exists for.
    console.warn('Could not stash the finished drive:', e);
  }
}

export function readPendingDrive(studentId) {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const { studentId: savedFor, prefill, savedAt } = JSON.parse(raw);
    if (savedFor !== studentId) return null;
    if (!savedAt || Date.now() - savedAt > MAX_AGE_MS) {
      clearPendingDrive();
      return null;
    }
    return prefill ?? null;
  } catch {
    return null;
  }
}

export function clearPendingDrive() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to do — an unreadable store is also an unwritable one.
  }
}
