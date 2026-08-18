import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function ShareModal({ studentId, student, onClose, onShare }) {
  const { shareStudent } = useApp();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleShare = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await shareStudent(studentId, email.trim(), email.split('@')[0]);
      setSuccess(`Shared with ${email}!`);
      setEmail('');
      setTimeout(() => {
        onShare?.();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to share student');
      console.error('Share error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <h3 style={{ fontSize: 18, marginBottom: 16 }}>Share {student.firstName}'s Profile</h3>

        <form onSubmit={handleShare} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-primary)' }}>
              Recipient Email
            </label>
            <input
              type="email"
              placeholder="parent@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                fontSize: 14,
                fontFamily: 'inherit',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {error && <p style={{ color: '#EF4444', fontSize: 13, margin: '0' }}>{error}</p>}
          {success && <p style={{ color: '#10B981', fontSize: 13, margin: '0' }}>{success}</p>}

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={loading}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !email.trim()}
              style={{ flex: 1 }}
            >
              {loading ? 'Sharing...' : 'Share'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
