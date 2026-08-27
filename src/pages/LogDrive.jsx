import React, { useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { randomEncouragement } from '../data/encouragements';
import DriveMap from '../components/DriveMap';
import ShareLinksMenu from '../components/ShareLinksMenu';
import { shareContent, hasNativeShare } from '../utils/share';
import { buildLogSnapshotUrl } from '../utils/snapshot';
import { readPendingDrive, clearPendingDrive } from '../utils/pendingDrive';
import {
  localOffsetMinutes,
  toZonedDateInput,
  toZonedTimeInput,
  fromZonedInputs,
  zonedHours,
} from '../utils/driveTime';
import { SKILL_CATEGORIES } from '../data/skillCategories';

const DRIVE_TYPES = [
  { label: 'Local', value: 'local' },
  { label: 'Rural', value: 'rural' },
  { label: 'Highway', value: 'highway' },
];

function guessTimeOfDay(instant, offsetMinutes) {
  const h = zonedHours(instant, offsetMinutes);
  return h >= 20 || h < 6 ? 'night' : 'day';
}

export default function LogDrive() {
  const { studentId, logId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { addLog, updateLog, deleteDrive, getLogs, students } = useApp();

  // Arrived here from the drive timer. Navigation state is the normal path;
  // sessionStorage is what survives a reload of this page, which would
  // otherwise drop the GPS results silently.
  const cameFromTimer = searchParams.get('pending') === '1';
  const prefill = useMemo(
    () => location.state?.prefill ?? (cameFromTimer ? readPendingDrive(studentId) : null),
    [location.state, cameFromTimer, studentId]
  );
  // Distinct from "the drive had no GPS fix": here the results existed and
  // were lost in transit, so the form says so rather than quietly saving a
  // timed drive with no distance and no map.
  const lostPrefill = cameFromTimer && !prefill;

  const isEditing = Boolean(logId);
  const existingLog = isEditing ? getLogs(studentId).find((l) => l.id === logId) : null;
  const student = students.find((s) => s.id === studentId);

  const now = new Date();
  const initialStart = existingLog
    ? new Date(existingLog.startTime)
    : prefill
    ? new Date(prefill.startTime)
    : now;
  const initialEnd = existingLog
    ? new Date(existingLog.endTime)
    : prefill
    ? new Date(prefill.endTime)
    : now;

  // The zone this drive is recorded in: the one it started in, falling back
  // to the device's current zone for drives logged by hand and for those
  // saved before the offset was stored. Fixed for the life of the form, so a
  // drive that crossed a boundary reads the same as the driver experienced it
  // — and stays that way if it is edited later from somewhere else.
  const [offsetMinutes] = useState(
    () =>
      existingLog?.startOffsetMinutes ??
      prefill?.startOffsetMinutes ??
      localOffsetMinutes()
  );

  const [dateStr, setDateStr] = useState(toZonedDateInput(initialStart, offsetMinutes));
  const [startStr, setStartStr] = useState(toZonedTimeInput(initialStart, offsetMinutes));
  const [endStr, setEndStr] = useState(toZonedTimeInput(initialEnd, offsetMinutes));
  const [timeOfDay, setTimeOfDay] = useState(
    existingLog?.timeOfDay ?? guessTimeOfDay(initialStart, offsetMinutes)
  );
  const [type, setType] = useState(existingLog?.type ?? 'local');
  const [distance, setDistance] = useState(
    existingLog?.distanceMiles != null
      ? String(existingLog.distanceMiles)
      : prefill?.distanceMiles != null
      ? String(prefill.distanceMiles)
      : ''
  );
  const [skills, setSkills] = useState(existingLog?.skills ?? []);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bragCopied, setBragCopied] = useState(false);
  const [bragMenuOpen, setBragMenuOpen] = useState(false);

  // Texas's own log is organized around these ten skill categories rather
  // than a running date/duration grid, so it requires at least one tag per
  // drive. Every other state's log — where it has a Comments or Skills
  // Practiced column at all — just prints whichever tags are set.
  const requireSkills = student?.state === 'TX';

  const toggleSkill = (key) => {
    setSkills((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const { startDate, endDate, durationMinutes } = useMemo(() => {
    const sd = fromZonedInputs(dateStr, startStr, offsetMinutes);
    let ed = fromZonedInputs(dateStr, endStr, offsetMinutes);
    if (ed < sd) ed = new Date(ed.getTime() + 24 * 60 * 60 * 1000); // crossed midnight
    const mins = Math.round((ed - sd) / 60000);
    return { startDate: sd, endDate: ed, durationMinutes: mins };
  }, [dateStr, startStr, endStr, offsetMinutes]);

  const fmtDuration = `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`;

  if (isEditing && !existingLog) {
    return <div className="page">Drive not found.</div>;
  }

  const handleSave = (e) => {
    e.preventDefault();
    setError('');
    if (durationMinutes <= 0) return setError('End time must be after start time.');

    // A drive can only be logged after it has happened. The cutoff is the end
    // of the current minute rather than this instant, because the form's
    // inputs have minute precision — entering the current time shouldn't be
    // rejected for being a few seconds ahead of the clock.
    const latestAllowed = new Date();
    latestAllowed.setSeconds(59, 999);
    if (startDate > latestAllowed) return setError("A drive can't start in the future.");
    if (endDate > latestAllowed) return setError("A drive can't end in the future.");

    if (distance && isNaN(parseFloat(distance))) return setError('Distance must be a number of miles.');

    if (requireSkills && skills.length === 0) {
      return setError("Select at least one skill practiced — Texas's log requires it for every drive.");
    }

    const fields = {
      date: dateStr,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      durationMinutes,
      timeOfDay,
      type,
      distanceMiles: distance ? parseFloat(distance) : null,
      skills,
      // Recorded so reopening this drive shows the same clock times it was
      // entered with, even from a device in another zone.
      startOffsetMinutes: offsetMinutes,
    };

    if (isEditing) {
      updateLog(studentId, logId, fields);
      navigate(`/dashboard/${studentId}`, { replace: true });
    } else {
      addLog(studentId, {
        ...fields,
        startLocation: prefill?.startLocation ?? null,
        endLocation: prefill?.endLocation ?? null,
        route: prefill?.route ?? null,
      });
      // Consumed — don't let it attach itself to the next drive logged.
      clearPendingDrive();
      navigate(`/dashboard/${studentId}`, { state: { celebrate: randomEncouragement() }, replace: true });
    }
  };

  const handleDelete = () => {
    deleteDrive(studentId, logId);
    navigate(`/dashboard/${studentId}`, { replace: true });
  };

  const showBragCopiedToast = () => {
    setBragCopied(true);
    setTimeout(() => setBragCopied(false), 2000);
  };

  const buildBragShareProps = () => {
    if (!student || !existingLog) return null;
    // No location fields — see src/utils/snapshot.js for why a shareable
    // link deliberately carries no coordinates.
    const url = buildLogSnapshotUrl({
      studentFirstName: student.firstName,
      date: existingLog.date,
      durationMinutes: existingLog.durationMinutes,
      type: existingLog.type,
      timeOfDay: existingLog.timeOfDay,
      distanceMiles: existingLog.distanceMiles,
    });
    return {
      title: `${student.firstName}'s drive`,
      text: `${student.firstName} just completed another drive!`,
      url,
    };
  };

  // On a device with a native share sheet, use it directly — the explicit
  // email/SMS/WhatsApp menu only stands in where there's no sheet to open.
  const handleBrag = () => {
    const shareProps = buildBragShareProps();
    if (!shareProps) return;
    if (hasNativeShare()) {
      shareContent(shareProps, { onCopied: showBragCopiedToast });
    } else {
      setBragMenuOpen((v) => !v);
    }
  };

  const handleBragCopyLink = async () => {
    setBragMenuOpen(false);
    const shareProps = buildBragShareProps();
    if (!shareProps) return;
    try {
      await navigator.clipboard.writeText(shareProps.url);
      showBragCopiedToast();
    } catch (err) {
      console.error('Copy to clipboard failed:', err);
    }
  };

  return (
    <div className="page">
      <h2 style={{ fontSize: 20, marginBottom: 6 }}>{isEditing ? 'Edit drive' : 'Log a drive'}</h2>

      {existingLog?.startLocation && existingLog?.endLocation && (
        <div style={{ marginBottom: 20 }}>
          <DriveMap start={existingLog.startLocation} end={existingLog.endLocation} route={existingLog.route} />
        </div>
      )}

      {lostPrefill && (
        <div
          style={{
            marginBottom: 20,
            padding: '12px 14px',
            backgroundColor: '#FFF7E6',
            border: '1px solid var(--line)',
            borderRadius: 8,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          This drive's details couldn't be recovered — the page was reloaded before it was saved, and
          the timed results are no longer available. The times below have defaulted to right now, so
          check them along with the distance before saving. The route map isn't recoverable.
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className="field">
          <label>Date</label>
          {/* Stops a later date being picked at all; handleSave still checks,
              since the date can also be typed and the times aren't capped. */}
          <input
            type="date"
            value={dateStr}
            max={toZonedDateInput(new Date(), offsetMinutes)}
            onChange={(e) => setDateStr(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Start Time</label>
          <input type="time" value={startStr} onChange={(e) => {
            setStartStr(e.target.value);
            setTimeOfDay(guessTimeOfDay(fromZonedInputs(dateStr, e.target.value, offsetMinutes), offsetMinutes));
          }} />
        </div>
        <div className="field">
          <label>End Time</label>
          <input type="time" value={endStr} onChange={(e) => setEndStr(e.target.value)} />
        </div>

        <div className="field">
          <label>Duration</label>
          <div className="duration-box">
            <span className="duration-value">{fmtDuration}</span>
            <span className="duration-hint">auto-calculated</span>
          </div>
        </div>

        <div className="field">
          <label>Time of Day</label>
          <div className="radio-row">
            {['day', 'night'].map((opt) => (
              <label key={opt} className={`radio-item ${opt === 'day' ? 'selected-day' : ''}`} style={{ cursor: 'pointer' }}
                     onClick={() => setTimeOfDay(opt)}>
                <span className={`radio-dot ${timeOfDay === opt ? 'active' : ''}`} />
                {opt === 'day' ? '☀️ Day' : '🌙 Night'}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {DRIVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Distance (miles)</label>
          <input type="number" step="0.1" min="0" placeholder="e.g. 12.5" value={distance}
                 onChange={(e) => setDistance(e.target.value)} />
        </div>

        <div className="field">
          <label>
            Skills Practiced {requireSkills ? '(required)' : '(optional)'}
          </label>
          <div className="skill-chip-row">
            {SKILL_CATEGORIES.map((cat) => (
              <button
                type="button"
                key={cat.key}
                className={`skill-chip ${skills.includes(cat.key) ? 'active' : ''}`}
                onClick={() => toggleSkill(cat.key)}
              >
                {cat.label}
              </button>
            ))}
          </div>
          {requireSkills && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
              Texas's log is organized by these categories — select whichever were practiced on this
              drive.
            </p>
          )}
        </div>

        {error && <p style={{ color: '#D8503F', fontSize: 13, marginTop: 14 }}>{error}</p>}

        {isEditing && existingLog && (
          <>
            <div style={{ position: 'relative', marginTop: 24 }}>
              <button type="button" className="btn btn-outline" onClick={handleBrag}>
                Brag on your student
              </button>
              {bragMenuOpen && (
                <ShareLinksMenu
                  {...buildBragShareProps()}
                  onClose={() => setBragMenuOpen(false)}
                  onCopyLink={handleBragCopyLink}
                />
              )}
            </div>
            {bragCopied && (
              <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>Link copied</p>
            )}
          </>
        )}

        <button type="submit" className="btn btn-primary" style={{ marginTop: isEditing && existingLog ? 12 : 24 }}>
          {isEditing ? 'Save changes' : 'Save drive'}
        </button>

        {isEditing && (
          <button
            type="button"
            className="btn"
            style={{ marginTop: 12, background: 'var(--danger)', color: 'var(--white)' }}
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete this drive
          </button>
        )}
      </form>

      {showDeleteConfirm && (
        <div className="modal-backdrop" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-text">Delete this drive?</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowDeleteConfirm(false)}>
                No
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleDelete}>
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
