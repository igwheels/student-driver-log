import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { STATE_REQUIREMENTS, STATE_LIST } from '../data/stateRequirements';
import { hasStateForm, stateFormLabel } from '../utils/stateFormFill';
import { getWeeklyEmailOptOut, setWeeklyEmailOptOut } from '../utils/emailPreferences';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fmtHours = (minutes) => (minutes / 60).toFixed(1);

/** "50 hours, 10 at night" — or that the state sets no minimum. */
function describeRequirement(stateCode) {
  const req = STATE_REQUIREMENTS[stateCode];
  if (!req) return null;
  if (req.totalHours === 0) return 'no minimum hours';
  return `${req.totalHours} hours${req.nightHours > 0 ? `, ${req.nightHours} at night` : ''}`;
}

export default function ManageStudents() {
  const {
    students,
    isOwner,
    updateStudentEmail,
    updateStudentState,
    deleteStudent,
    getTotals,
  } = useApp();
  const ownedStudents = students.filter((s) => isOwner(s.id));

  // Weekly-email opt-in per student, keyed by studentId — the preference
  // document lives on the student's own email address (see
  // src/utils/emailPreferences.js), same mechanism as the Account page's
  // "Send me weekly progress emails" checkbox, just toggled here on the
  // student's behalf since they can no longer sign in themselves. No
  // document for an address means subscribed, so each entry defaults to
  // true until its actual preference loads.
  const [weeklyEmailOptIns, setWeeklyEmailOptIns] = useState({});
  useEffect(() => {
    ownedStudents.forEach((s) => {
      if (!s.email) return;
      getWeeklyEmailOptOut(s.email).then((optedOut) =>
        setWeeklyEmailOptIns((prev) => ({ ...prev, [s.id]: !optedOut }))
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students]);

  const handleWeeklyEmailToggle = async (student, checked) => {
    setWeeklyEmailOptIns((prev) => ({ ...prev, [student.id]: checked }));
    try {
      await setWeeklyEmailOptOut(student.email, !checked);
    } catch (e) {
      console.error('Failed to update email preference:', e);
      setWeeklyEmailOptIns((prev) => ({ ...prev, [student.id]: !checked }));
    }
  };

  // The badge itself is the control: it already shows the state, so changing
  // it needs no separate field or section. Choosing from the list opens a
  // confirmation rather than saving straight away — the requirement a
  // dashboard is measured against is not something to change on a mis-tap,
  // and what it does to the gauges isn't obvious without being told.
  const [stateEditingId, setStateEditingId] = useState(null);
  const [stateBusyId, setStateBusyId] = useState(null);
  const [pendingState, setPendingState] = useState(null); // { student, nextState } | null
  const [stateNote, setStateNote] = useState(null); // { id, text } | null
  const [stateError, setStateError] = useState(null); // { id, text } | null

  const chooseState = (student, nextState) => {
    setStateEditingId(null);
    setStateError(null);
    if (!nextState || nextState === student.state) return;
    setPendingState({ student, nextState });
  };

  const confirmStateChange = async () => {
    if (!pendingState) return;
    const { student, nextState } = pendingState;
    const from = STATE_REQUIREMENTS[student.state]?.name ?? student.state;
    setStateBusyId(student.id);
    try {
      await updateStudentState(student.id, nextState);
      setPendingState(null);
      setStateNote({
        id: student.id,
        text: `Moved from ${from} to ${STATE_REQUIREMENTS[nextState].name}. Every logged drive was kept.`,
      });
    } catch (e) {
      setPendingState(null);
      setStateError({ id: student.id, text: e.message || 'Could not update the state.' });
    } finally {
      setStateBusyId(null);
    }
  };

  /**
   * What changing state actually does. The drives are untouched, so the whole
   * effect is on the requirement they're measured against — which can move a
   * dashboard from finished to well short without a single drive changing.
   */
  const stateChangeImpact = ({ student, nextState }) => {
    const from = STATE_REQUIREMENTS[student.state];
    const to = STATE_REQUIREMENTS[nextState];
    const { totalMinutes, nightMinutes } = getTotals(student.id);
    const lines = [];

    const shortfall = (loggedMinutes, goalHours) => {
      const remaining = goalHours * 60 - loggedMinutes;
      return remaining <= 0
        ? 'already met'
        : `${fmtHours(remaining)} more needed`;
    };

    if (to.totalHours > 0) {
      lines.push(
        `Total: ${fmtHours(totalMinutes)} logged against ${to.totalHours} required — ${shortfall(totalMinutes, to.totalHours)}.`
      );
    } else {
      lines.push(`${to.name} sets no minimum, so the hour gauges no longer apply.`);
    }

    if (to.nightHours > 0) {
      lines.push(
        `Night: ${fmtHours(nightMinutes)} logged against ${to.nightHours} required — ${shortfall(nightMinutes, to.nightHours)}.`
      );
    } else if (from.nightHours > 0) {
      lines.push(`${to.name} has no separate night requirement.`);
    }

    // The DMV button resolves by state, so this changes what it produces.
    if (hasStateForm(nextState)) {
      lines.push(`Form for DMV will produce ${to.name}'s ${stateFormLabel(nextState)}.`);
    } else if (hasStateForm(student.state)) {
      lines.push(
        `Form for DMV will produce the general affidavit instead of ${from.name}'s ${stateFormLabel(student.state)}.`
      );
    }

    return lines;
  };

  const [editingId, setEditingId] = useState(null);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const startEdit = (student) => {
    setEditingId(student.id);
    setEmailInput(student.email || '');
    setEmailError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEmailInput('');
    setEmailError('');
  };

  const saveEdit = async (student) => {
    setEmailError('');
    if (!EMAIL_RE.test(emailInput.trim())) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setSaving(true);
    try {
      await updateStudentEmail(student.id, emailInput.trim());
      cancelEdit();
    } catch (e) {
      setEmailError(e.message || 'Could not update email.');
    } finally {
      setSaving(false);
    }
  };

  const fullName = (student) => `${student.firstName} ${student.lastName}`;

  const confirmDelete = async () => {
    if (!deleteTarget || deleteInput !== fullName(deleteTarget)) return;
    setDeleting(true);
    try {
      await deleteStudent(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteInput('');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page">
      <h2 style={{ fontSize: 22, marginBottom: 18 }}>Manage students</h2>

      {ownedStudents.length === 0 ? (
        <div className="empty-state">You don't own any student dashboards yet.</div>
      ) : (
        ownedStudents.map((s) => (
          <div key={s.id} className="plate-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="name">{fullName(s)}</div>
                {/* The requirement, not just the state name — it's the reason
                    someone would change the state, and there's no hover to
                    reveal a title attribute on a phone. */}
                <div className="sub">
                  {STATE_REQUIREMENTS[s.state]?.name} — {describeRequirement(s.state)}
                </div>
              </div>
              {/* The badge is the control. Only the list of real states can
                  be chosen from it, so there is no way to land on a code the
                  app doesn't recognise. */}
              {stateEditingId === s.id ? (
                <select
                  autoFocus
                  value={s.state}
                  onChange={(e) => chooseState(s, e.target.value)}
                  onBlur={() => setStateEditingId(null)}
                  aria-label={`State of residence for ${fullName(s)}`}
                  style={{
                    padding: '5px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--navy)',
                    fontSize: 13,
                    maxWidth: 180,
                  }}
                >
                  {STATE_LIST.map((st) => (
                    <option key={st.code} value={st.code}>{st.name}</option>
                  ))}
                </select>
              ) : (
                <button
                  className="plate-badge"
                  onClick={() => {
                    setStateEditingId(s.id);
                    setStateNote(null);
                    setStateError(null);
                  }}
                  disabled={stateBusyId === s.id}
                  title={`${STATE_REQUIREMENTS[s.state]?.name} — ${describeRequirement(s.state)}. Tap to change.`}
                  style={{ border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {stateBusyId === s.id ? '…' : s.state}
                  <span aria-hidden="true" style={{ fontSize: 9, opacity: 0.7 }}>▼</span>
                </button>
              )}
            </div>

            {stateNote?.id === s.id && (
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
                {stateNote.text}
              </p>
            )}
            {stateError?.id === s.id && (
              <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10, marginBottom: 0 }}>
                {stateError.text}
              </p>
            )}

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 6 }}>
                Student email
              </div>

              {editingId === s.id ? (
                <>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="student@example.com"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--line)',
                      fontSize: 14,
                    }}
                  />
                  {emailError && (
                    <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{emailError}</p>
                  )}
                  <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                    <button
                      className="btn btn-outline"
                      style={{ width: 'auto', padding: '8px 16px' }}
                      onClick={cancelEdit}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary"
                      style={{ width: 'auto', padding: '8px 16px' }}
                      onClick={() => saveEdit(s)}
                      disabled={saving}
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: s.email ? 'var(--navy)' : 'var(--muted)' }}>
                    {s.email || 'No email set'}
                  </span>
                  <button
                    className="btn btn-outline"
                    style={{ width: 'auto', padding: '6px 14px', fontSize: 13 }}
                    onClick={() => startEdit(s)}
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            {s.email && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={weeklyEmailOptIns[s.id] ?? true}
                    onChange={(e) => handleWeeklyEmailToggle(s, e.target.checked)}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>
                    Send {s.firstName} weekly progress emails
                  </span>
                </label>
              </div>
            )}

            <button
              className="btn"
              style={{ marginTop: 14, background: 'var(--danger)', color: 'var(--white)' }}
              onClick={() => {
                setDeleteTarget(s);
                setDeleteInput('');
              }}
            >
              Delete student
            </button>
          </div>
        ))
      )}

      {pendingState && (
        <div className="modal-backdrop" onClick={() => setPendingState(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-text" style={{ marginBottom: 4 }}>
              Move {pendingState.student.firstName} to{' '}
              {STATE_REQUIREMENTS[pendingState.nextState].name}?
            </div>

            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '10px 0 14px', lineHeight: 1.5 }}>
              {STATE_REQUIREMENTS[pendingState.student.state]?.name}:{' '}
              {describeRequirement(pendingState.student.state)}
              {' → '}
              {STATE_REQUIREMENTS[pendingState.nextState].name}:{' '}
              {describeRequirement(pendingState.nextState)}
            </p>

            <ul style={{ fontSize: 13, color: 'var(--navy)', textAlign: 'left', margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
              {stateChangeImpact(pendingState).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>

            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 14, marginBottom: 0, lineHeight: 1.5 }}>
              Every logged drive is kept — only the requirement they count toward changes. You can
              change it back at any time.
            </p>

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button
                className="btn btn-outline"
                style={{ flex: 1 }}
                onClick={() => setPendingState(null)}
                disabled={stateBusyId === pendingState.student.id}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={confirmStateChange}
                disabled={stateBusyId === pendingState.student.id}
              >
                {stateBusyId === pendingState.student.id ? 'Saving…' : 'Change state'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-text">
              Type {deleteTarget.firstName}'s full name to permanently delete this dashboard and all
              logged drives:
            </div>
            <input
              type="text"
              placeholder={fullName(deleteTarget)}
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              style={{ marginTop: 16, marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn btn-outline"
                style={{ flex: 1 }}
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn"
                style={{ flex: 1, background: 'var(--danger)', color: 'var(--white)' }}
                disabled={deleteInput !== fullName(deleteTarget) || deleting}
                onClick={confirmDelete}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
