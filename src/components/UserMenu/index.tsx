import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ROUTES } from '@/constants/routes';

/**
 * UserMenu - Displays current user and logout button
 */
export function UserMenu() {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const [ambientEnabled, setAmbientEnabled] = useState<boolean>(() => {
    try {
      const envDefault = String(import.meta.env.VITE_AMBIENT_ENABLED ?? 'true').toLowerCase() !== 'false';
      const ls = localStorage.getItem('ambientEnabled');
      return ls === null ? envDefault : ls === 'true';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const storageHandler = (e: StorageEvent) => {
      if (e.key === 'ambientEnabled') {
        setAmbientEnabled(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', storageHandler);
    return () => window.removeEventListener('storage', storageHandler);
  }, []);

  const toggleAmbient = () => {
    try {
      const next = !ambientEnabled;
      localStorage.setItem('ambientEnabled', String(next));
      setAmbientEnabled(next);
      window.dispatchEvent(new Event('ambient:toggle'));
    } catch {
      setAmbientEnabled(!ambientEnabled);
    }
  };

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
          onClick={toggleAmbient}
          className="settings-btn aura-toggle"
          aria-pressed={ambientEnabled}
          title={ambientEnabled ? 'Turn off ambient overlay' : 'Turn on ambient overlay'}
        >
          {ambientEnabled ? 'Ambient: On' : 'Ambient: Off'}
        </button>
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
