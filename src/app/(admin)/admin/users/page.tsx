export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/admin-auth';
import { listManagedUsers } from '@/lib/admin/user-management';
import { listPendingUserInvites } from '@/lib/repositories';
import { getAdminAuth } from '@/lib/firebase/admin';
import { UserRoleForm } from './UserRoleForm';
import { StaffPhoneForm } from './StaffPhoneForm';

async function listStaffPhoneUsers() {
  const auth = getAdminAuth();
  const results: { uid: string; phoneNumber: string }[] = [];
  let pageToken: string | undefined;

  while (true) {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      const claims = user.customClaims as Record<string, unknown> | undefined;
      if (
        user.phoneNumber &&
        !user.email && // phone-only users
        claims?.role === 'staff'
      ) {
        results.push({ uid: user.uid, phoneNumber: user.phoneNumber });
      }
    }
    if (!page.pageToken) break;
    pageToken = page.pageToken;
  }

  return results;
}

export default async function AdminUsersPage() {
  await requireRole('owner');
  const [users, pendingInvites, staffPhoneUsers] = await Promise.all([
    listManagedUsers(),
    listPendingUserInvites(),
    listStaffPhoneUsers(),
  ]);

  return (
    <>
      <div className="admin-page-header">
        <h1>Users</h1>
      </div>
      <p className="admin-section-desc">
        Invite users by email and assign a role, or assign roles to existing
        Firebase Auth users. Owner accounts remain immutable from this panel.
      </p>

      <UserRoleForm />

      <StaffPhoneForm staffPhoneUsers={staffPhoneUsers} />

      <div className="admin-table-wrap">
        <h2 className="admin-section-title">Pending Invites</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Invited By</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {pendingInvites.map(invite => (
              <tr key={invite.id}>
                <td>{invite.email}</td>
                <td>{invite.role}</td>
                <td>{invite.invitedByEmail ?? invite.invitedByUid}</td>
                <td>{invite.updatedAt.toLocaleString()}</td>
              </tr>
            ))}
            {pendingInvites.length === 0 ? (
              <tr>
                <td colSpan={4} className="admin-empty">
                  No pending invites.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="admin-table-wrap">
        <h2 className="admin-section-title">Firebase Auth Users</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Display Name</th>
              <th>UID</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.uid}>
                <td>{user.email}</td>
                <td>{user.displayName}</td>
                <td>{user.uid}</td>
                <td>{user.role}</td>
              </tr>
            ))}
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="admin-empty">
                  No users found yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
