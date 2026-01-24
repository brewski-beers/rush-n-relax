import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserRepository } from '@/repositories/UserRepository';
import { queryClient } from '@/lib/queryClient';

export function CreateGuestStaff() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [contactMethod, setContactMethod] = useState<'email' | 'phone'>('email');
  const [contact, setContact] = useState('');
  const [contactVerified, setContactVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!user || (user.role !== 'staff' && user.role !== 'manager' && user.role !== 'admin')) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (contactMethod === 'email') {
      if (!contact || !contact.includes('@')) {
        setMessage('Please enter a valid email.');
        return;
      }
    } else {
      if (!contact || contact.replace(/\D/g, '').length < 10) {
        setMessage('Please enter a valid phone number.');
        return;
      }
    }

    try {
      setSubmitting(true);
      await UserRepository.createGuest(
        { displayName },
        user.uid
      );
      setMessage('Guest registered. You can promote to customer when ready.');
      setDisplayName('');
      setContact('');
      setContactVerified(false);
      queryClient.invalidateQueries({ queryKey: ['users', 'admin'] });
    } catch (err) {
      setMessage(`Failed to register guest: ${err instanceof Error ? err.message : 'Unknown error'}`);
      // eslint-disable-next-line no-console
      console.error('Create guest error', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="guest-card">
      <h2 className="guest-title">Register Guest</h2>
      <form onSubmit={onSubmit} className="guest-form">
        <div className="field">
          <label>Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Guest name (optional)"
          />
        </div>

        <div className="field">
          <label>Contact Method</label>
          <select
            value={contactMethod}
            onChange={(e) => setContactMethod(e.target.value as 'email' | 'phone')}
          >
            <option value="email">Email</option>
            <option value="phone">Phone</option>
          </select>
        </div>

        <div className="field">
          <label>{contactMethod === 'email' ? 'Email' : 'Phone'}</label>
          <input
            type={contactMethod === 'email' ? 'email' : 'tel'}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder={contactMethod === 'email' ? 'name@example.com' : '(555) 123-4567'}
            required
          />
        </div>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={contactVerified}
            onChange={(e) => setContactVerified(e.target.checked)}
          />
          Contact Verified
        </label>

        <button type="submit" disabled={submitting} className="guest-btn">
          {submitting ? 'Saving…' : 'Add Guest'}
        </button>
      </form>
      {message && <p className="guest-message">{message}</p>}

      <style>{`
        .guest-card { border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 0.75rem; padding: 1rem; margin-bottom: 1.5rem; background: linear-gradient(145deg, rgba(16, 24, 21, 0.9), rgba(16, 24, 21, 0.82)); box-shadow: 0 12px 30px rgba(0, 0, 0, 0.32); }
        .guest-title { margin: 0 0 0.75rem 0; font-size: 1.2rem; }
        .guest-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem; align-items: end; }
        .field { display: flex; flex-direction: column; gap: 0.25rem; }
        .field label { font-size: 0.85rem; color: rgba(245, 245, 245, 0.7); }
        .field input, .field select { padding: 0.5rem 0.6rem; border: 1px solid var(--color-border, #333); border-radius: 0.375rem; background: var(--color-bg, #0f1419); color: var(--color-text, #f5f5f5); }
        .checkbox { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem; color: var(--color-text, #f5f5f5); }
        .guest-btn { padding: 0.6rem 0.9rem; border-radius: 0.375rem; border: 1px solid var(--secondary); background: var(--secondary); color: white; cursor: pointer; }
        .guest-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .guest-message { grid-column: 1 / -1; margin-top: 0.5rem; }
      `}</style>
    </div>
  );
}
