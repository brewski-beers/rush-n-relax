import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserRepository } from '@/repositories/UserRepository';
import { ROLE_CONFIG } from '@/config/roles';
import { queryClient } from '@/lib/queryClient';
import type { UserRole } from '@/types';

export function CreateUserAdmin() {
  const { user: currentUser } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!currentUser) return null;

  const allowedInviteRoles: UserRole[] =
    currentUser.role === 'admin'
      ? ['staff', 'manager']
      : currentUser.role === 'manager'
      ? ['staff']
      : [];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!allowedInviteRoles.includes(role)) {
      setMessage(`You can't invite role: ${role}`);
      return;
    }

    if (!email || !email.includes('@')) {
      setMessage('Please enter a valid email.');
      return;
    }

    try {
      setSubmitting(true);
      const inviteRole = role === 'admin' ? 'manager' : (role as 'manager' | 'staff' | 'customer');
      await UserRepository.inviteUser(email, inviteRole, currentUser.uid);
      setMessage(`Invitation sent to ${email} for ${ROLE_CONFIG[role]?.label || role}.`);
      setEmail('');
      setRole(allowedInviteRoles[0]);
      // Refresh users list
      queryClient.invalidateQueries({ queryKey: ['users', 'admin'] });
    } catch (err) {
      setMessage(
        `Failed to send invite: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
      // eslint-disable-next-line no-console
      console.error('Invite error', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (allowedInviteRoles.length === 0) return null;

  return (
    <div className="invite-card">
      <h2 className="invite-title">Invite User</h2>
      <form onSubmit={onSubmit} className="invite-form">
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            required
          />
        </div>
        <div className="field">
          <label>Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            {allowedInviteRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_CONFIG[r]?.label || r}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={submitting} className="invite-btn">
          {submitting ? 'Sending…' : 'Send Invite'}
        </button>
      </form>
      {message && <p className="invite-message">{message}</p>}

      <style>{`
        .invite-card {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.75rem;
          padding: 1rem;
          margin-bottom: 1.5rem;
          background: linear-gradient(145deg, rgba(16, 24, 21, 0.9), rgba(16, 24, 21, 0.82));
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.32);
        }
        .invite-title {
          margin: 0 0 0.75rem 0;
          font-size: 1.2rem;
        }
        .invite-form {
          display: flex;
          gap: 1rem;
          align-items: flex-end;
          flex-wrap: wrap;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          min-width: 220px;
        }
        .field label {
          font-size: 0.85rem;
          color: rgba(245, 245, 245, 0.7);
        }
        .field input, .field select {
          padding: 0.5rem 0.6rem;
          border: 1px solid var(--color-border);
          border-radius: 0.375rem;
          background: var(--color-bg);
          color: var(--color-text);
        }
        .invite-btn {
          padding: 0.6rem 0.9rem;
          border-radius: 0.375rem;
          border: 1px solid var(--color-primary);
          background: var(--color-primary);
          color: white;
          cursor: pointer;
        }
        .invite-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .invite-message { margin-top: 0.75rem; font-size: 0.9rem; }
      `}</style>
    </div>
  );
}
