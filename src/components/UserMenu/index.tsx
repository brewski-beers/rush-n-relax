import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';

/**
 * UserMenu - Displays current user and logout button
 */
export function UserMenu() {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <button onClick={() => navigate('/login')} className="nav-link">
        Login
      </button>
    );
  }

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="user-menu">
      <span className="user-email">
        {user.displayName || user.email}
        {user.role !== 'customer' && <span className="user-role"> ({user.role})</span>}
      </span>
      <div className="user-actions">
        <button
          onClick={() => navigate(ROUTES.ACCOUNT)}
          className="settings-btn"
          title="Account settings"
        >
          ⚙️
        </button>
        <button
          onClick={handleLogout}
          disabled={isLoading}
          className="logout-btn"
        >
          {isLoading ? 'Logging out...' : 'Logout'}
        </button>
      </div>
    </div>
  );
}
