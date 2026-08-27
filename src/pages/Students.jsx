import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { STATE_REQUIREMENTS } from '../data/stateRequirements';

// Whole hours, rounded to one decimal — enough to see progress at a glance
// without the card turning into a second dashboard.
const fmtHours = (minutes) => (minutes / 60).toFixed(1);

function StudentCard({ student, totals, shared }) {
  const navigate = useNavigate();
  const req = STATE_REQUIREMENTS[student.state];
  const goalHours = req?.totalHours ?? 0;
  const doneHours = fmtHours(totals.totalMinutes);
  const open = () => navigate(`/dashboard/${student.id}`);

  return (
    <div
      className="plate-card"
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && open()}
      style={{ cursor: 'pointer', ...(shared ? { opacity: 0.8 } : null) }}
    >
      <div>
        <div className="name">{student.firstName} {student.lastName}</div>
        <div className="sub" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{req?.name}</span>
          {shared && (
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>
              • Shared{student.ownerName ? ` by ${student.ownerName}` : ''}
            </span>
          )}
        </div>
        <div className="sub mono" style={{ marginTop: 6, color: 'var(--navy)' }}>
          {goalHours > 0 ? (
            <>
              {doneHours} <span style={{ color: 'var(--muted)' }}>of {goalHours} hrs</span>
            </>
          ) : (
            // Some states set no minimum, so there's no total to count toward.
            <>
              {doneHours} <span style={{ color: 'var(--muted)' }}>hrs · no state minimum</span>
            </>
          )}
        </div>
      </div>
      <div className="plate-badge">{student.state}</div>
    </div>
  );
}

export default function Students() {
  const { students, isOwner, getTotals } = useApp();
  const navigate = useNavigate();

  const owned = students.filter((s) => isOwner(s.id));
  const shared = students.filter((s) => !isOwner(s.id));

  return (
    <div className="page">
      <h2 style={{ fontSize: 22, marginBottom: 18 }}>Your student drivers</h2>

      {students.length === 0 ? (
        <div className="empty-state">No student drivers yet. Add one to start logging hours.</div>
      ) : (
        <div>
          {owned.map((s) => (
            <StudentCard key={s.id} student={s} totals={getTotals(s.id)} />
          ))}

          {shared.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, color: 'var(--muted)', marginTop: 24, marginBottom: 12 }}>Shared with you</h3>
              {shared.map((s) => (
                <StudentCard key={s.id} student={s} totals={getTotals(s.id)} shared />
              ))}
            </>
          )}
        </div>
      )}

      <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => navigate('/add-student')}>
        + Add a student driver
      </button>
    </div>
  );
}
