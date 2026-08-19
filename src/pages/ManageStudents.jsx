import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { STATE_REQUIREMENTS } from '../data/stateRequirements';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ManageStudents() {
  const { students, isOwner, updateStudentEmail, deleteStudent } = useApp();
  const ownedStudents = students.filter((s) => isOwner(s.id));

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
                <div className="sub">{STATE_REQUIREMENTS[s.state]?.name}</div>
              </div>
              <div className="plate-badge">{s.state}</div>
            </div>

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
