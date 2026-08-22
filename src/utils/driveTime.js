/**
 * Reads and writes a drive's wall-clock date and time in a fixed UTC offset,
 * rather than whatever zone the device happens to be in right now.
 *
 * A drive that crosses a time-zone boundary is logged in the zone it STARTED
 * in. Instants (startTime/endTime) are stored as absolute ISO timestamps and
 * are unambiguous either way — the problem is the wall clock the form shows
 * and the calendar date it saves, which previously came from the device's
 * current zone. Drive east across a boundary near midnight and the phone
 * changes zone mid-drive, so a drive begun at 11:30pm gets written down as
 * 12:30am the following day: right instant, wrong day, and not what the
 * driver experienced.
 *
 * Each drive therefore records the offset in effect where and when it began
 * (startOffsetMinutes, minutes east of UTC), and every conversion between an
 * instant and the form's date/time fields goes through that offset. A drive
 * saved before this existed, or logged by hand, has no stored offset and
 * falls back to the device's current one — which is exactly the previous
 * behaviour.
 *
 * A fixed numeric offset rather than a named zone is deliberate: it is what
 * "the time zone of the start time" actually pins down, and it keeps a drive
 * that straddles a DST change from being re-read against the wrong side of
 * it. The trade-off is that the offset is a snapshot, so it does not describe
 * the zone's rules — which is fine, since nothing here needs to project
 * beyond the drive itself.
 */

const MS_PER_MINUTE = 60000;
const pad = (n) => String(n).padStart(2, '0');

/** Minutes east of UTC for a given instant on this device (UTC+2 -> 120). */
export function localOffsetMinutes(date = new Date()) {
  // getTimezoneOffset() is minutes *behind* UTC, so it reads inverted.
  return -date.getTimezoneOffset();
}

// Shifting by the offset lets the UTC getters read out the wall clock in that
// offset, which avoids re-deriving calendar arithmetic by hand.
function shift(instant, offsetMinutes) {
  return new Date(instant.getTime() + offsetMinutes * MS_PER_MINUTE);
}

/** 'YYYY-MM-DD' as it reads in the given offset. */
export function toZonedDateInput(instant, offsetMinutes) {
  const d = shift(instant, offsetMinutes);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 'HH:MM' as it reads in the given offset. */
export function toZonedTimeInput(instant, offsetMinutes) {
  const d = shift(instant, offsetMinutes);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Hour of day (0-23) as it reads in the given offset. */
export function zonedHours(instant, offsetMinutes) {
  return shift(instant, offsetMinutes).getUTCHours();
}

/**
 * The instant at which the given wall-clock date and time occur in the given
 * offset — the inverse of the two functions above. Returns an Invalid Date
 * for unparseable input, matching what `new Date(string)` would have done.
 */
export function fromZonedInputs(dateStr, timeStr, offsetMinutes) {
  const [year, month, day] = String(dateStr).split('-').map(Number);
  const [hours, minutes] = String(timeStr).split(':').map(Number);
  if ([year, month, day, hours, minutes].some((n) => !Number.isFinite(n))) return new Date(NaN);
  return new Date(Date.UTC(year, month - 1, day, hours, minutes) - offsetMinutes * MS_PER_MINUTE);
}
