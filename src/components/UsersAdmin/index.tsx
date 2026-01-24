import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { UserRepository } from '@/repositories/UserRepository';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_CONFIG, canModifyRole } from '@/config/roles';
import type { User, UserRole } from '@/types';
import { queryClient } from '@/lib/queryClient';
import { CreateUserAdmin } from '@/components/CreateUserAdmin';
import { CreateGuestStaff } from '@/components/CreateGuestStaff';
import { EditDisplayName } from '@/components/EditDisplayName';

const MODIFIABLE_ROLES: UserRole[] = ['customer', 'staff', 'manager'];

export function UsersAdmin() {
  const { user: currentUser } = useAuth();
  const { data: allUsers = [] } = useSuspenseQuery({
    queryKey: ['users', 'admin'],
    queryFn: () => UserRepository.getAllUsers(),
    staleTime: 2 * 60 * 1000,
  });

  if (!currentUser) return null;

  // Filter users based on current user's role
  const visibleUsers = allUsers.filter(u => {
    // Admin can see everyone
    if (currentUser.role === 'admin') return true;
    // Manager can see staff, customers, and guests
    if (currentUser.role === 'manager') return u.role === 'staff' || u.role === 'customer' || u.role === 'guest';
    // Staff can see customers and guests
    if (currentUser.role === 'staff') return u.role === 'customer' || u.role === 'guest';
    return false;
  });

  const [filter, setFilter] = useState<UserRole | 'all'>('all');
  const [updating, setUpdating] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const filteredUsers = filter === 'all' 
    ? visibleUsers 
    : visibleUsers.filter(u => u.role === filter);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (!canModifyRole(currentUser.role, newRole)) {
      alert(`You don't have permission to assign ${newRole} role`);
      return;
    }

    setUpdating(userId);
    try {
      await UserRepository.updateUserRole(userId, newRole, currentUser.uid, currentUser.role);
      // Revalidate query
      queryClient.invalidateQueries({ queryKey: ['users', 'admin'] });
    } catch (error) {
      alert(`Failed to update user role: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Failed to update user role:', error);
    } finally {
      setUpdating(null);
    }
  };

  // Get modifiable roles for current user
  const getModifiableRoles = () => {
    if (currentUser.role === 'admin') {
      return ['customer', 'staff', 'manager', 'guest'];
    }
    if (currentUser.role === 'manager') {
      return ['customer', 'staff', 'guest'];
    }
    if (currentUser.role === 'staff') {
      // Staff can promote guest → customer, and adjust guest details
      return ['guest', 'customer'];
    }
    return [];
  };

  const modifiableRoles = getModifiableRoles();

  return (
    <div className="admin-section">
      <div className="section-header">
        <h1>👥 Users Management</h1>
        <p className="subtitle">Manage user roles and permissions</p>
      </div>

      {/* Register Guest (staff/manager/admin) */}
      {(currentUser.role === 'staff' || currentUser.role === 'manager' || currentUser.role === 'admin') && (
        <CreateGuestStaff />
      )}

      {/* Invite Form (admin/manager only) */}
      {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
        <CreateUserAdmin />
      )}

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {(['all', 'guest', 'customer', 'staff', ...(currentUser.role === 'admin' ? ['manager'] : [])] as const).map((role) => {
          const visibleCount = role === 'all' 
            ? visibleUsers.length
            : visibleUsers.filter(u => u.role === role).length;
          return (
            <button
              key={role}
              className={`filter-btn ${filter === role ? 'active' : ''}`}
              onClick={() => setFilter(role as UserRole | 'all')}
            >
              {role === 'all' ? 'All Users' : ROLE_CONFIG[role as UserRole]?.label || role}
              {` (${visibleCount})`}
            </button>
          );
        })}
      </div>

      {/* Users Table */}
      <div className="users-table-wrapper">
        <table className="users-table">
          <thead>
            <tr>
              <th></th>
              <th>Email</th>
              <th>Name</th>
              <th>Current Role</th>
              <th>Action</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-state">
                  No users found in this category
                </td>
              </tr>
            ) : (
              filteredUsers.map(user => (
                <>
                  <tr key={user.uid} className="user-row">
                    <td className="expand-cell">
                      <button
                        className="expand-btn"
                        onClick={() => setExpandedUser(expandedUser === user.uid ? null : user.uid)}
                        title="View details"
                      >
                        {expandedUser === user.uid ? '▼' : '▶'}
                      </button>
                    </td>
                    <td className="email-cell">
                      <code>{user.email}</code>
                    </td>
                    <td className="name-cell">
                      <EditDisplayName user={user} />
                    </td>
                    <td>
                      <span 
                        className={`role-badge role-${user.role}`}
                        style={{ borderLeftColor: ROLE_CONFIG[user.role]?.color }}
                      >
                        {ROLE_CONFIG[user.role]?.label || user.role}
                      </span>
                    </td>
                    <td className="action-cell">
                      {modifiableRoles.includes(user.role) ? (
                        <div className="role-selector">
                          <select
                            value={user.role}
                            onChange={e => handleRoleChange(user.uid, e.target.value as UserRole)}
                            disabled={updating === user.uid}
                            className="role-select"
                          >
                            {modifiableRoles.map(role => (
                              <option key={role} value={role}>
                                {ROLE_CONFIG[role as UserRole]?.label || role}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <span className="protected-role">Protected</span>
                      )}
                    </td>
                    <td className="date-cell">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                  
                  {/* Expanded Details Row */}
                  {expandedUser === user.uid && (
                    <tr className="details-row">
                      <td colSpan={8}>
                        <div className="user-details">
                          <div className="details-grid">
                            <div className="detail-section">
                              <h4>Role & Permissions</h4>
                              <dl>
                                <dt>Assigned Role:</dt>
                                <dd>
                                  <code className={`role-code role-${user.role}`}>
                                    {user.role}
                                  </code>
                                </dd>
                                <dt>Role Label:</dt>
                                <dd>{ROLE_CONFIG[user.role]?.label || 'Unknown'}</dd>
                                <dt>Custom Claims:</dt>
                                <dd>
                                  <code className="json-block">
                                    {JSON.stringify({ role: user.role }, null, 2)}
                                  </code>
                                </dd>
                              </dl>
                            </div>

                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .section-header {
          margin-bottom: 2rem;
        }

        .section-header h1 {
          margin: 0 0 0.5rem 0;
          font-size: 1.75rem;
        }

        .subtitle {
          margin: 0;
          color: var(--color-text-secondary);
          font-size: 0.95rem;
        }

        .filter-tabs {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
          flex-wrap: wrap;
        }

        .filter-btn {
          padding: 0.5rem 1rem;
          border: 1px solid var(--color-border);
          border-radius: 0.5rem;
          background: transparent;
          color: var(--color-text);
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;
        }

        .filter-btn:hover {
          background: var(--color-bg-tertiary);
          border-color: var(--color-primary);
        }

        .filter-btn.active {
          background: var(--color-primary);
          color: white;
          border-color: var(--color-primary);
        }

        .users-table-wrapper {
          overflow-x: auto;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.75rem;
          background: linear-gradient(145deg, rgba(16, 24, 21, 0.9), rgba(16, 24, 21, 0.82));
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.32);
        }

        .users-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
        }

        .users-table th {
          background: rgba(255, 255, 255, 0.04);
          padding: 1rem;
          text-align: left;
          font-weight: 600;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          color: rgba(245, 245, 245, 0.75);
        }

        .users-table td {
          padding: 1rem;
          border-bottom: 1px solid var(--color-border);
        }

        .user-row:hover {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
        }

        .email-cell code {
          background: var(--color-bg-tertiary);
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-family: 'Courier New', monospace;
          font-size: 0.85rem;
        }

        .name-cell {
          min-width: 200px;
        }

        .role-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 0.35rem;
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
          border-left: 3px solid;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.06);
          color: rgba(245, 245, 245, 0.9);
        }

        /* status badge styles provided globally; keep minimal overrides here if necessary */

        .action-cell {
          min-width: 150px;
        }

        .role-selector {
          display: inline-block;
        }

        .role-select {
          padding: 0.5rem;
          border: 1px solid var(--color-border);
          border-radius: 0.375rem;
          background: var(--color-bg);
          color: var(--color-text);
          cursor: pointer;
          font-size: 0.85rem;
        }

        .role-select:hover {
          border-color: var(--color-primary);
        }

        .role-select:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .protected-role {
          color: var(--color-text-secondary);
          font-size: 0.8rem;
        }

        .date-cell {
          color: var(--color-text-secondary);
          font-size: 0.85rem;
        }

        .expand-cell {
          width: 40px;
          padding: 1rem 0.5rem;
          text-align: center;
        }

        .expand-btn {
          background: none;
          border: none;
          color: var(--color-text-secondary);
          cursor: pointer;
          font-size: 0.9rem;
          padding: 0.25rem 0.5rem;
          transition: color 0.2s;
        }

        .expand-btn:hover {
          color: var(--color-text);
        }

        .details-row {
          background: var(--color-bg-tertiary);
        }

        .details-row td {
          padding: 2rem;
          border-bottom: none;
        }

        .user-details {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.75rem;
          background: linear-gradient(145deg, rgba(16, 24, 21, 0.92), rgba(16, 24, 21, 0.86));
          padding: 1.5rem;
          box-shadow: 0 10px 26px rgba(0, 0, 0, 0.28);
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
        }

        .detail-section {
          border-left: 3px solid var(--color-primary);
          padding-left: 1rem;
        }

        .detail-section h4 {
          margin: 0 0 1rem 0;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .detail-section dl {
          display: grid;
          grid-template-columns: max-content 1fr;
          gap: 0.5rem 1rem;
          row-gap: 1rem;
          margin: 0;
          font-size: 0.85rem;
        }

        .detail-section dt {
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .detail-section dd {
          margin: 0;
          word-break: break-word;
        }

        .role-code {
          display: inline-block;
          background: var(--color-bg-tertiary);
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-family: 'Courier New', monospace;
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .json-block {
          display: block;
          background: var(--color-bg-tertiary);
          padding: 0.75rem;
          border-radius: 0.25rem;
          font-family: 'Courier New', monospace;
          font-size: 0.75rem;
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-word;
          color: var(--color-text-secondary);
          margin-top: 0.5rem;
        }

        .inviter-cell {
          color: var(--color-text-secondary);
          font-size: 0.85rem;
        }

        .inviter-info {
          display: inline-block;
          background: rgba(0, 0, 0, 0.2);
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.8rem;
        }

        .self-signup {
          color: var(--color-text-secondary);
          font-size: 0.8rem;
        }

        .empty-state {
          text-align: center;
          padding: 2rem !important;
          color: var(--color-text-secondary);
        }

        @media (max-width: 768px) {
          .users-table {
            font-size: 0.8rem;
          }

          .users-table th,
          .users-table td {
            padding: 0.75rem 0.5rem;
          }

          .email-cell code {
            font-size: 0.75rem;
          }
      `}</style>
    </div>
  );
}

