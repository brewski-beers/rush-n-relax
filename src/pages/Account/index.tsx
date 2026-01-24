import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { EditDisplayName } from '@/components/EditDisplayName';

/**
 * Account Page - User profile and settings
 * Accessible to authenticated users
 */
export function Account() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="account-page">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="account-page">
      <div className="account-container">
        <h1>👤 Account Settings</h1>
        
        <div className="account-section">
          <h2>Profile Information</h2>
          
          <div className="form-group">
            <label>Email</label>
            <div className="form-value readonly">
              <code>{user.email}</code>
            </div>
            <p className="help-text">Your email address cannot be changed</p>
          </div>

          <div className="form-group">
            <label>Display Name</label>
            <div className="form-value">
              <EditDisplayName user={user} compact />
            </div>
            <p className="help-text">
              {user.role === 'customer' 
                ? 'This is how other users will see you in the system'
                : 'Your name as it appears throughout the application'}
            </p>
          </div>

          <div className="form-group">
            <label>Role</label>
            <div className="form-value readonly">
              <span className={`role-badge role-${user.role}`}>
                {user.role.toUpperCase()}
              </span>
            </div>
            <p className="help-text">Contact an administrator to request role changes</p>
          </div>
        </div>

        <div className="account-section">
          <h2>Account Information</h2>
          
          <div className="status-grid">
            <div className="status-item">
              <span className="status-label">Account Created:</span>
              <span className="status-value">
                {user.createdAt && new Date(user.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div className="account-section info-section">
          <h3>ℹ️ About Your Account</h3>
          <ul className="info-list">
            <li>Your display name helps other staff identify you in conversations and logs</li>
            <li>You can update your display name anytime from this page</li>
            <li>Your email address is your unique identifier and cannot be changed</li>
            <li>If you need to change your email or role, please contact an administrator</li>
          </ul>
        </div>
      </div>

      <style>{`
        .account-page {
          min-height: calc(100vh - 120px);
          background: #0f1419;
          padding: 2rem 1rem;
        }

        .account-container {
          max-width: 600px;
          margin: 0 auto;
          background: #1a1f25;
          border-radius: 0.5rem;
          padding: 2rem;
          border: 1px solid #333;
        }

        .account-page h1 {
          margin: 0 0 2rem 0;
          font-size: 1.75rem;
          color: #f5f5f5;
        }

        .account-section {
          margin-bottom: 2rem;
          padding-bottom: 2rem;
          border-bottom: 1px solid #333;
        }

        .account-section:last-child {
          border-bottom: none;
          padding-bottom: 0;
          margin-bottom: 0;
        }

        .account-section h2 {
          margin: 0 0 1.5rem 0;
          font-size: 1.2rem;
          color: #f5f5f5;
        }

        .account-section h3 {
          margin: 0 0 1rem 0;
          font-size: 1.1rem;
          color: #f5f5f5;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #cde7d3;
          font-size: 0.95rem;
        }

        .form-value {
          padding: 1rem;
          border-radius: 0.375rem;
          background: #0f1419;
          border: 1px solid #333;
          color: #f5f5f5;
        }

        .form-value.readonly {
          background: #16201b;
          border-color: #2a3a2f;
          color: #aaa;
        }

        .form-value code {
          background: #16201b;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-family: 'Courier New', monospace;
          font-size: 0.9rem;
          color: #cde7d3;
        }

        .help-text {
          margin: 0.5rem 0 0 0;
          font-size: 0.85rem;
          color: #7f8c85;
        }

        .role-badge {
          display: inline-block;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 0.8rem;
          background: rgba(0, 0, 0, 0.2);
          border-left: 3px solid;
        }

        .role-customer {
          border-left-color: #3b82f6;
          color: #3b82f6;
        }

        .role-staff {
          border-left-color: #22c55e;
          color: #22c55e;
        }

        .role-manager {
          border-left-color: #fb923c;
          color: #fb923c;
        }

        .role-admin {
          border-left-color: #a78bfa;
          color: #a78bfa;
        }

        .status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
        }

        .status-item {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .status-label {
          font-weight: 600;
          color: #cde7d3;
          font-size: 0.9rem;
        }

        .status-value,
        .status-badge {
          color: #f5f5f5;
          font-size: 0.95rem;
        }

        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 0.25rem;
          background: rgba(0, 0, 0, 0.2);
          width: fit-content;
        }

        .status-verified {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.4);
        }

        .info-section {
          background: rgba(205, 231, 211, 0.05);
          border-radius: 0.375rem;
          padding: 1.5rem;
          border: 1px solid rgba(205, 231, 211, 0.2);
          border-bottom: 1px solid rgba(205, 231, 211, 0.2);
        }

        .info-list {
          margin: 0;
          padding-left: 1.5rem;
          color: #cde7d3;
          line-height: 1.8;
        }

        .info-list li {
          margin-bottom: 0.5rem;
        }

        .loading {
          text-align: center;
          padding: 2rem;
          color: #7f8c85;
        }

        @media (max-width: 600px) {
          .account-container {
            padding: 1.5rem;
          }

          .status-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
