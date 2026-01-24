import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export type AdminTab = 'dashboard' | 'products' | 'categories' | 'orders' | 'staff';

interface AdminLayoutProps {
  children: React.ReactNode;
}

/**
 * AdminLayout - Wrapper for admin pages
 * Only accessible by admins/managers
 */
export function AdminLayout({ children }: AdminLayoutProps) {
  const { user } = useAuth();

  // Redirect non-admins
  if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
