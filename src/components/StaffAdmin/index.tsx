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
              <StaffCard key={member.uid} member={member} />
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
          background: linear-gradient(150deg, rgba(16, 24, 21, 0.9), rgba(16, 24, 21, 0.82));
          padding: 1.5rem;
          border-radius: 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.32);
        }

        .stat-label {
          font-size: 0.85rem;
          color: rgba(245, 245, 245, 0.7);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.35rem;
          font-weight: 600;
        }

        .stat-value {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }

        .stat-subtext {
          font-size: 0.8rem;
          color: rgba(245, 245, 245, 0.6);
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
          padding: 1rem;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 0.75rem;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
        }

        @media (max-width: 768px) {
          .staff-grid {
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
            gap: 1rem;
          }
          .staff-card {
            padding: 1.25rem;
          }
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
          background: linear-gradient(145deg, rgba(16, 24, 21, 0.9), rgba(16, 24, 21, 0.8));
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.75rem;
          padding: 1.5rem;
          box-shadow: 0 14px 36px rgba(0, 0, 0, 0.32);
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
          position: relative;
          overflow: hidden;
        }

        .staff-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.06), transparent 55%);
          pointer-events: none;
          opacity: 0.6;
        }

        .staff-card:hover {
          border-color: var(--color-primary, #d5b36a);
          box-shadow: 0 18px 42px rgba(0, 0, 0, 0.4);
          transform: translateY(-2px);
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
