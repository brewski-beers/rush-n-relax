import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserMenu } from '@/components/UserMenu';

export function Header() {
  const { user } = useAuth();
  const isAdminOrManager = user && (user.role === 'admin' || user.role === 'manager');
  const isStaff = user && (user.role === 'staff' || user.role === 'manager' || user.role === 'admin');

  return (
    <header className="header">
      <div className="logo" aria-label="TechByBrewski logo">
        <span className="logo-mark">TB</span>
        <span className="logo-text">techByBrewski</span>
      </div>
      <nav className="nav">
        <Link to="/">Shop</Link>
        <Link to="/about">About</Link>
        <Link to="/locations">Locations</Link>
        <Link to="/contact">Contact</Link>
        {isStaff && (
          <Link to="/kiosk" className="kiosk-link" title="In-store sales mode">
            📱 Kiosk
          </Link>
        )}
        {isAdminOrManager && (
          <Link to="/admin" className="admin-link" title={`${user.role.charAt(0).toUpperCase() + user.role.slice(1)} Portal`}>
            ⚙️ Admin
          </Link>
        )}
      </nav>
      <UserMenu />
    </header>
  );
}
