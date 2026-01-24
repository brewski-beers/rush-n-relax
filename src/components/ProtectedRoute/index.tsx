import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/types';

/**
 * ProtectedRoute component - restricts access to specific user roles
 * 
 * Usage:
 * <ProtectedRoute requiredRoles={['admin', 'staff']}>
 *   <AdminPanel />
 * </ProtectedRoute>
 */
export function ProtectedRoute({
  children,
  requiredRoles,
  fallbackPath = '/login',
}: {
  children: React.ReactNode;
  requiredRoles: UserRole[];
  fallbackPath?: string;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user || !requiredRoles.includes(user.role)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
