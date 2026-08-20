import React, { useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { randomEncouragement } from '../data/encouragements';

const DRIVE_TYPES = [
  { label: 'Local', value: 'local' },
  { label: 'Rural', value: 'rural' },
  { label: 'Highway', value: 'highway' },
];

function toDateInputValue(d) {
  return d.toISOString().slice(0, 10);
}
function toTimeInputValue(d) {
  return d.toTimeString().slice(0, 5);
}
function guessTimeOfDay(d) {
  const h = d.getHours();
  return h >= 20 || h < 6 ? 'night' : 'day';
}

export default function LogDrive() {
  const { studentId, logId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { addLog, updateLog, deleteDrive, getLogs } = useApp();
  const prefill = location.state?.prefill;

  const isEditing = Boolean(logId);
  const existingLog = isEditing ? getLogs(studentId).find((l) => l.id === logId) : null;

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

  const [dateStr, setDateStr] = useState(toDateInputValue(initialStart));
  const [startStr, setStartStr] = useState(toTimeInputValue(initialStart));
  const [endStr, setEndStr] = useState(toTimeInputValue(initialEnd));
  const [timeOfDay, setTimeOfDay] = useState(existingLog?.timeOfDay ?? guessTimeOfDay(initialStart));
  const [type, setType] = useState(existingLog?.type ?? 'local');
  const [distance, setDistance] = useState(
    existingLog?.distanceMiles != null
      ? String(existingLog.distanceMiles)
      : prefill?.distanceMiles != null
      ? String(prefill.distanceMiles)
      : ''
  );
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { startDate, endDate, durationMinutes } = useMemo(() => {
    const sd = new Date(`${dateStr}T${startStr}:00`);
    let ed = new Date(`${dateStr}T${endStr}:00`);
    if (ed < sd) ed = new Date(ed.getTime() + 24 * 60 * 60 * 1000); // crossed midnight
    const mins = Math.round((ed - sd) / 60000);
    return { startDate: sd, endDate: ed, durationMinutes: mins };
  }, [dateStr, startStr, endStr]);

  const fmtDuration = `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`;

  if (isEditing && !existingLog) {
    return <div className="page">Drive not found.</div>;
  }

  const handleSave = (e) => {
    e.preventDefault();
    setError('');
    if (durationMinutes <= 0) return setError('End time must be after start time.');
    if (distance && isNaN(parseFloat(distance))) return setError('Distance must be a number of miles.');

    const fields = {
      date: dateStr,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      durationMinutes,
      timeOfDay,
      type,
      distanceMiles: distance ? parseFloat(distance) : null,
    };

    if (isEditing) {
      updateLog(studentId, logId, fields);
      navigate(`/dashboard/${studentId}`, { replace: true });
    } else {
      addLog(studentId, {
        ...fields,
        startLocation: prefill?.startLocation ?? null,
        endLocation: prefill?.endLocation ?? null,
      });
      navigate(`/dashboard/${studentId}`, { state: { celebrate: randomEncouragement() }, replace: true });
    }
  };

  const handleDelete = () => {
    deleteDrive(studentId, logId);
    navigate(`/dashboard/${studentId}`, { replace: true });
  };

  return (
    <div className="page">
      <h2 style={{ fontSize: 20, marginBottom: 6 }}>{isEditing ? 'Edit drive' : 'Log a drive'}</h2>
      <form onSubmit={handleSave}>
        <div className="field">
          <label>Date</label>
          <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
        </div>
        <div className="field">
          <label>Start Time</label>
          <input type="time" value={startStr} onChange={(e) => {
            setStartStr(e.target.value);
            setTimeOfDay(guessTimeOfDay(new Date(`${dateStr}T${e.target.value}:00`)));
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

        {error && <p style={{ color: '#D8503F', fontSize: 13, marginTop: 14 }}>{error}</p>}

        <button type="submit" className="btn btn-primary" style={{ marginTop: 24 }}>
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
