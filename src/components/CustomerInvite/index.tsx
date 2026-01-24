import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserRepository } from '@/repositories/UserRepository';

export function CustomerInvite() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!user || user.role !== 'customer') return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!email || !email.includes('@')) {
      setMessage('Please enter a valid email.');
      return;
    }

    try {
      setSubmitting(true);
      await UserRepository.inviteUser(email, 'customer', user.uid);
      setMessage(`Invitation sent to ${email}.`);
      setEmail('');
    } catch (err) {
      const code = (err as any)?.code;
      if (code === 'failed-precondition') {
        setMessage('Invite requires contact verification. Please verify your email/phone.');
      } else if (code === 'permission-denied') {
        setMessage('You are not allowed to send invites.');
      } else if (code === 'already-exists') {
        setMessage('That email already has an account.');
      } else {
        setMessage(`Failed to send invite: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
      // eslint-disable-next-line no-console
      console.error('Invite error', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="invite-card">
      <h3>Invite a Friend</h3>
      <p className="invite-subtitle">
        Customers can invite friends after verifying their contact info.
      </p>
      <form onSubmit={onSubmit} className="invite-form">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="friend@example.com"
          required
          className="invite-input"
        />
        <button type="submit" disabled={submitting} className="invite-btn">
          {submitting ? 'Sending…' : 'Send Invite'}
        </button>
      </form>
      {message && <p className="invite-message">{message}</p>}

      <style>{`
        .invite-card { margin: 2rem 1rem; padding: 1rem; border: 1px solid #333; border-radius: 0.5rem; background: #1a1f25; }
        .invite-subtitle { color: #aaa; margin: 0.5rem 0 1rem; }
        .invite-form { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        .invite-input { flex: 1; min-width: 240px; padding: 0.6rem; border: 1px solid #333; border-radius: 0.375rem; background: #0f1419; color: #f5f5f5; }
        .invite-btn { padding: 0.6rem 0.9rem; border-radius: 0.375rem; border: 1px solid var(--secondary); background: var(--secondary); color: white; cursor: pointer; }
        .invite-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .invite-message { margin-top: 0.75rem; font-size: 0.9rem; }
      `}</style>
    </div>
  );
}
