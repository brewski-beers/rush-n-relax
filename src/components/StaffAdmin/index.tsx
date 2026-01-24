import { useSuspenseQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { UserRepository } from '@/repositories/UserRepository';
import { ROLE_CONFIG } from '@/config/roles';
import type { User } from '@/types';

export function StaffAdmin() {
  const { user: currentUser } = useAuth();
  const { data: staffMembers = [] } = useSuspenseQuery({
    queryKey: ['staff', 'admin'],
    queryFn: () => UserRepository.getStaffMembers(),
    staleTime: 2 * 60 * 1000,
  });

  const { data: userCounts = { admin: 0, manager: 0, staff: 0, customer: 0 } } = useSuspenseQuery({
    queryKey: ['user-counts', 'admin'],
    queryFn: () => UserRepository.getUserCountByRole(),
    staleTime: 2 * 60 * 1000,
  });

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="admin-section">
        <p>You don't have permission to view staff management.</p>
      </div>
    );
  }

  return (
    <div className="admin-section">
      <div className="section-header">
        <h1>👔 Staff Management</h1>
        <p className="subtitle">Manage your team members and their permissions</p>
      </div>

      {/* Staff Overview Cards */}
      <div className="staff-stats">
        <div className="stat-card">
          <div className="stat-label">Admins</div>
          <div className="stat-value" style={{ color: ROLE_CONFIG.admin.color }}>
            {userCounts.admin}
          </div>
          <div className="stat-subtext">Full system access</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Managers</div>
          <div className="stat-value" style={{ color: ROLE_CONFIG.manager.color }}>
            {userCounts.manager}
          </div>
          <div className="stat-subtext">Manage staff & customers</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Staff</div>
          <div className="stat-value" style={{ color: ROLE_CONFIG.staff.color }}>
            {userCounts.staff}
          </div>
          <div className="stat-subtext">Help customers</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Customers</div>
          <div className="stat-value" style={{ color: ROLE_CONFIG.customer.color }}>
            {userCounts.customer}
          </div>
          <div className="stat-subtext">Active users</div>
        </div>
      </div>

      {/* Staff List */}
      <div className="staff-section">
        <h2>Team Members ({staffMembers.length})</h2>
        {staffMembers.length === 0 ? (
          <div className="empty-placeholder">
            <p>No staff members yet. Promote users from the Users panel to get started!</p>
          </div>
        ) : (
          <div className="staff-grid">
            {staffMembers.map(member => (
              <StaffCard key={member.id} member={member} />
            ))}
          </div>
        )}
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

        .staff-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-bottom: 3rem;
        }

        .stat-card {
          background: var(--color-bg-secondary);
          padding: 1.5rem;
          border-radius: 0.5rem;
          border: 1px solid var(--color-border);
        }

        .stat-label {
          font-size: 0.85rem;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }

        .stat-value {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }

        .stat-subtext {
          font-size: 0.8rem;
          color: var(--color-text-secondary);
        }

        .staff-section {
          margin-top: 2rem;
        }

        .staff-section h2 {
          margin: 0 0 1.5rem 0;
          font-size: 1.25rem;
        }

        .staff-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .empty-placeholder {
          text-align: center;
          padding: 3rem;
          background: var(--color-bg-secondary);
          border-radius: 0.5rem;
          border: 1px dashed var(--color-border);
          color: var(--color-text-secondary);
        }

        .empty-placeholder p {
          margin: 0;
        }
      `}</style>
    </div>
  );
}

/**
 * StaffCard - Individual staff member card
 */
function StaffCard({ member }: { member: User }) {
  const roleColor = ROLE_CONFIG[member.role]?.color || '#6b7280';

  return (
    <div className="staff-card">
      <div className="staff-header">
        <div className="staff-avatar" style={{ backgroundColor: roleColor }}>
          {member.email.charAt(0).toUpperCase()}
        </div>
        <div className="staff-info">
          <h3>{member.displayName || member.email}</h3>
          <p className="staff-email">{member.email}</p>
        </div>
      </div>

      <div className="staff-details">
        <div className="detail-item">
          <span className="detail-label">Role</span>
          <span 
            className="detail-value role-badge"
            style={{ borderLeftColor: roleColor }}
          >
            {ROLE_CONFIG[member.role]?.label || member.role}
          </span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Joined</span>
          <span className="detail-value">
            {new Date(member.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      <style>{`
        .staff-card {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: 0.5rem;
          padding: 1.5rem;
          transition: all 0.2s;
        }

        .staff-card:hover {
          border-color: var(--color-primary);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .staff-header {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
          align-items: flex-start;
        }

        .staff-avatar {
          width: 3rem;
          height: 3rem;
          border-radius: 50%;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.2rem;
          flex-shrink: 0;
        }

        .staff-info {
          flex: 1;
        }

        .staff-info h3 {
          margin: 0 0 0.25rem 0;
          font-size: 1rem;
        }

        .staff-email {
          margin: 0;
          font-size: 0.85rem;
          color: var(--color-text-secondary);
        }

        .staff-details {
          display: grid;
          gap: 0.75rem;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          font-size: 0.9rem;
        }

        .detail-label {
          color: var(--color-text-secondary);
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .detail-value {
          font-weight: 500;
        }

        .detail-value.role-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 0.25rem;
          background: rgba(0, 0, 0, 0.05);
          font-size: 0.8rem;
          border-left: 3px solid;
        }
      `}</style>
    </div>
  );
}
