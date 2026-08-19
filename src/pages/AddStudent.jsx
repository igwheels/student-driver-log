import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { STATE_LIST, STATE_REQUIREMENTS } from '../data/stateRequirements';

export default function AddStudent() {
  const { addStudent } = useApp();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState('');
  const [error, setError] = useState('');

  const req = state ? STATE_REQUIREMENTS[state] : null;

  const handleSave = (e) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim()) return setError("Please enter the student's first and last name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Please enter a valid email address.');
    if (!state) return setError("Please select the student's state of residence.");

    const id = addStudent({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), state });
    navigate(`/dashboard/${id}`);
  };

  return (
    <div className="page">
      <h2 style={{ fontSize: 20, marginBottom: 6 }}>Add a student driver</h2>
      <form onSubmit={handleSave}>
        <div className="field">
          <label>First name</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
        </div>
        <div className="field">
          <label>Last name</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
        </div>
        <div className="field">
          <label>Student email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@example.com" />
        </div>
        <div className="field">
          <label>State of residence</label>
          <select value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">Select a state…</option>
            {STATE_LIST.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>

        {req && (
          <div className="req-note">
            {req.totalHours > 0 ? (
              <>
                <div className="req-title">
                  {req.name} requires {req.totalHours} supervised hours
                  {req.nightHours > 0 ? `, ${req.nightHours} at night` : ''}.*
                </div>
                {req.note && <div className="req-sub">{req.note}</div>}
              </>
            ) : (
              <div className="req-title">
                {req.name} does not require a minimum number of supervised driving hours.*
              </div>
            )}
          </div>
        )}

        {error && <p style={{ color: '#D8503F', fontSize: 13, marginTop: 14 }}>{error}</p>}

        <button type="submit" className="btn btn-primary" style={{ marginTop: 24 }}>Add student</button>
      </form>

      {req && (
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 20 }}>
          * Requirements sourced from the{' '}
          <a
            href="https://www.iihs.org/research-areas/teenagers/graduated-licensing-laws-table"
            target="_blank"
            rel="noopener noreferrer"
          >
            IIHS Graduated Licensing Laws table
          </a>
          . Laws change — verify with your state DMV.
        </p>
      )}
    </div>
  );
}
