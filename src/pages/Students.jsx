import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { STATE_REQUIREMENTS } from '../data/stateRequirements';

export default function Students() {
  const { students } = useApp();
  const navigate = useNavigate();

  return (
    <div className="page">
      <h2 style={{ fontSize: 22, marginBottom: 18 }}>Your student drivers</h2>

      {students.length === 0 ? (
        <div className="empty-state">No student drivers yet. Add one to start logging hours.</div>
      ) : (
        students.map((s) => (
          <div key={s.id} className="plate-card" onClick={() => navigate(`/dashboard/${s.id}`)} role="button" tabIndex={0}
               onKeyDown={(e) => e.key === 'Enter' && navigate(`/dashboard/${s.id}`)}
               style={{ cursor: 'pointer' }}>
            <div>
              <div className="name">{s.firstName} {s.lastName}</div>
              <div className="sub">{STATE_REQUIREMENTS[s.state]?.name}</div>
            </div>
            <div className="plate-badge">{s.state}</div>
          </div>
        ))
      )}

      <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => navigate('/add-student')}>
        + Add a student driver
      </button>
    </div>
  );
}
