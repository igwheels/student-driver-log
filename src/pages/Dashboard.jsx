import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { STATE_REQUIREMENTS } from '../data/stateRequirements';
import Gauge from '../components/Gauge';
import { exportLogPdf } from '../utils/pdfExport';

export default function Dashboard() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { students, getLogs, getTotals, user } = useApp();
  const student = students.find((s) => s.id === studentId);
  const [celebration, setCelebration] = useState(location.state?.celebrate ?? null);

  if (!student) return <div className="page">Student not found.</div>;

  const req = STATE_REQUIREMENTS[student.state];
  const { totalMinutes, nightMinutes } = getTotals(studentId);
  const logs = getLogs(studentId);
  const hasRequirement = req.totalHours > 0;

  const fmtDuration = (mins) => `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;

  return (
    <div className="page">
      <h2 style={{ fontSize: 24 }}>{student.firstName} {student.lastName}</h2>
      <p style={{ color: 'var(--muted)', marginTop: 2, marginBottom: 22 }}>{req.name}</p>

      {hasRequirement ? (
        <div className="dash-panel">
          <Gauge label="Total hours" value={totalMinutes} goal={req.totalHours * 60} color="#2F6FDE" />
          {req.nightHours > 0 && (
            <Gauge label="Night hours" value={nightMinutes} goal={req.nightHours * 60} color="#6C5CE7" />
          )}
        </div>
      ) : (
        <div className="no-req-card">
          Your state of residence does not require a minimum number of supervised driving hours.
          Way to go above and beyond!
        </div>
      )}

      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button className="btn btn-primary" onClick={() => navigate(`/drive-timer/${studentId}`)}>
          Start a Drive
        </button>
        <button className="btn btn-dark" onClick={() => navigate(`/log-drive/${studentId}`)}>
          Log a Drive
        </button>
        <button
          className="btn btn-outline"
          disabled={logs.length === 0}
          onClick={() => exportLogPdf({ student, req, logs, totals: { totalMinutes, nightMinutes }, parentName: user?.name ?? '' })}
        >
          Download Log
        </button>
      </div>

      <h3 style={{ fontSize: 17, marginTop: 30, marginBottom: 10 }}>Recent drives</h3>
      {logs.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No drives logged yet. Start one above!</p>
      ) : (
        <div className="ledger">
          {logs.slice(0, 10).map((l) => (
            <div key={l.id} className="ledger-row">
              <div>
                <div className="date">{l.date}</div>
                <div className="meta">{l.type} · {l.timeOfDay}{l.distanceMiles != null ? ` · ${l.distanceMiles} mi` : ''}</div>
              </div>
              <div className="duration mono">{fmtDuration(l.durationMinutes)}</div>
            </div>
          ))}
        </div>
      )}

      {celebration && (
        <div className="modal-backdrop" onClick={() => setCelebration(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-emoji">🎉</div>
            <div className="modal-text">{celebration}</div>
            <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => setCelebration(null)}>
              Keep going!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
