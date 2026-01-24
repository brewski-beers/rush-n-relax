import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserRepository } from '@/repositories/UserRepository';
import { canUpdateDisplayName } from '@/config/roles';
import type { User } from '@/types';
import { queryClient } from '@/lib/queryClient';

interface EditDisplayNameProps {
  user: User;
  onSuccess?: () => void;
  compact?: boolean;
}

/**
 * EditDisplayName - Allow users to update their display name
 * Customers can only update their own
 * Staff/Manager/Admin can update customers below them
 */
export function EditDisplayName({ user, onSuccess, compact = false }: EditDisplayNameProps) {
  const { user: currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!currentUser) return null;

  const canEdit = canUpdateDisplayName(currentUser.role, user.id, currentUser.id, user.role);

  if (!canEdit) {
    return (
      <div className="display-name-view">
        <span className="display-name-text">{user.displayName || '—'}</span>
      </div>
    );
  }

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    setIsLoading(true);

    try {
      await UserRepository.updateDisplayName(
        user.id,
        displayName,
        currentUser.id,
        currentUser.role
      );
      setSuccess(true);
      setIsEditing(false);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['users'] });
      
      // Call onSuccess callback if provided
      onSuccess?.();

      // Clear success message after 2 seconds
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update display name');
      console.error('Failed to update display name:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setDisplayName(user.displayName || '');
    setIsEditing(false);
    setError(null);
  };

  if (!isEditing) {
    return (
      <div className="display-name-view">
        <span className="display-name-text">{user.displayName || '—'}</span>
        <button
          className="edit-btn"
          onClick={() => setIsEditing(true)}
          title={currentUser.id === user.id ? 'Edit your display name' : 'Edit this user\'s display name'}
          aria-label="Edit display name"
        >
          ✏️
        </button>
      </div>
    );
  }

  return (
    <div className={`display-name-edit ${compact ? 'compact' : ''}`}>
      <input
        type="text"
        value={displayName}
        onChange={e => setDisplayName(e.target.value)}
        placeholder="Enter display name"
        maxLength={100}
        disabled={isLoading}
        autoFocus
        className="display-name-input"
      />
      <div className="edit-actions">
        <button
          onClick={handleSave}
          disabled={isLoading || !displayName.trim()}
          className="btn-save"
        >
          {isLoading ? '…' : '✓'}
        </button>
        <button
          onClick={handleCancel}
          disabled={isLoading}
          className="btn-cancel"
        >
          ✕
        </button>
      </div>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">Display name updated!</div>}
    </div>
  );
}
