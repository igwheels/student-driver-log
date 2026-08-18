import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { STATE_REQUIREMENTS } from '../data/stateRequirements';
import Gauge from '../components/Gauge';
import ShareModal from '../components/ShareModal';
import { exportLogPdf } from '../utils/pdfExport';

export default function Dashboard() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { students, getLogs, getTotals, user, deleteStudent, deleteDrive, isOwner, unshareStudent } = useApp();
  const student = students.find((s) => s.id === studentId);
  const [celebration, setCelebration] = useState(location.state?.celebrate ?? null);
  const [deleteStep, setDeleteStep] = useState(null);
  const [deleteInput, setDeleteInput] = useState('');
  const [showAllDrives, setShowAllDrives] = useState(false);
  const [deleteDriveId, setDeleteDriveId] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharedUsers, setSharedUsers] = useState([]);

  // Update shared users when student changes
  useEffect(() => {
    if (student) {
      setSharedUsers(student.sharedWith || []);
    }
  }, [student?.id]);

  useEffect(() => {
    const handleDeleteClick = () => setDeleteStep('confirm');
    window.addEventListener('openDeletePrompt', handleDeleteClick);
    return () => window.removeEventListener('openDeletePrompt', handleDeleteClick);
  }, []);

  const handleDeleteConfirm = () => {
    if (!deleteStep) return;
    if (deleteStep === 'confirm') {
      setDeleteStep('nameInput');
      setDeleteInput('');
    } else if (deleteStep === 'nameInput') {
      if (deleteInput.trim() === `${student.firstName} ${student.lastName}`) {
        deleteStudent(studentId);
        navigate('/students');
      } else {
        setDeleteInput('');
      }
    }
  };

  const handleDeleteDriveConfirm = () => {
    if (deleteDriveId) {
      deleteDrive(studentId, deleteDriveId);
      setDeleteDriveId(null);
    }
  };

  const handleUnshare = async (email) => {
    try {
      await unshareStudent(studentId, email);
      setSharedUsers((prev) => prev.filter((u) => u.email !== email));
    } catch (e) {
      console.error('Failed to unshare:', e);
    }
  };

  if (!student) return <div className="page">Student not found.</div>;

  const req = STATE_REQUIREMENTS[student.state];
  const { totalMinutes, nightMinutes } = getTotals(studentId);
  const logs = getLogs(studentId);
  const hasRequirement = req.totalHours > 0;

  const fmtDuration = (mins) => `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        <h2 style={{ fontSize: 24, margin: 0 }}>{student.firstName}'s Dashboard</h2>
        {!isOwner(studentId) && (
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--navy)',
            backgroundColor: 'var(--line)',
            padding: '4px 8px',
            borderRadius: 4,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            Shared{student.ownerName ? ` by ${student.ownerName}` : ''}
          </span>
        )}
      </div>
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
        {isOwner(studentId) && (
          <button className="btn btn-ghost" onClick={() => setShowShareModal(true)}>
            Share
          </button>
        )}
      </div>

      {isOwner(studentId) && sharedUsers.length > 0 && (
        <div style={{ marginTop: 24, padding: 16, backgroundColor: 'var(--white)', border: '1px solid var(--line)', borderRadius: 8 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginTop: 0, marginBottom: 12 }}>Shared with</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sharedUsers.map((share) => (
              <div
                key={share.email}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  backgroundColor: 'var(--off-white)',
                  borderRadius: 6,
                  fontSize: 14,
                }}
              >
                <span>{share.email}</span>
                <button
                  onClick={() => handleUnshare(share.email)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    fontSize: 13,
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <h3 style={{ fontSize: 17, marginTop: 30, marginBottom: 10 }}>Recent drives</h3>
      {logs.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No drives logged yet. Start one above!</p>
      ) : (
        <>
          <div className="ledger">
            {logs.slice(0, showAllDrives ? logs.length : 5).map((l) => (
              <div
                key={l.id}
                className="ledger-row"
                onClick={() => setDeleteDriveId(l.id)}
                style={{ cursor: 'pointer' }}
              >
                <div>
                  <div className="date">{l.date}</div>
                  <div className="meta">{l.type} · {l.timeOfDay}{l.distanceMiles != null ? ` · ${l.distanceMiles} mi` : ''}</div>
                </div>
                <div className="duration mono">{fmtDuration(l.durationMinutes)}</div>
              </div>
            ))}
          </div>
          {!showAllDrives && logs.length > 5 && (
            <button
              onClick={() => setShowAllDrives(true)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted)',
                fontSize: 14,
                marginTop: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                gap: 8,
              }}
            >
              Show all
              <span style={{ fontSize: 16 }}>↓</span>
            </button>
          )}
        </>
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

      {deleteStep === 'confirm' && (
        <div className="modal-backdrop" onClick={() => setDeleteStep(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-text">Delete all {student.firstName}'s records?</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setDeleteStep(null)}>
                No
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleDeleteConfirm}>
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteStep === 'nameInput' && (
        <div className="modal-backdrop" onClick={() => setDeleteStep(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-text">Type {student.firstName}'s full name to confirm deletion:</div>
            <input
              type="text"
              placeholder={`${student.firstName} ${student.lastName}`}
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              style={{ marginTop: 16, marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setDeleteStep(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={deleteInput.trim() !== `${student.firstName} ${student.lastName}`}
                onClick={handleDeleteConfirm}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteDriveId && (
        <div className="modal-backdrop" onClick={() => setDeleteDriveId(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-text">Delete this drive?</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setDeleteDriveId(null)}>
                No
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleDeleteDriveConfirm}>
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <ShareModal
          studentId={studentId}
          student={student}
          onClose={() => setShowShareModal(false)}
          onShare={() => {
            // Refresh shared users
            const updatedStudent = students.find((s) => s.id === studentId);
            if (updatedStudent) {
              setSharedUsers(updatedStudent.sharedWith || []);
            }
          }}
        />
      )}
    </div>
  );
}
