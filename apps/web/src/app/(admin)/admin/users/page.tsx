export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/admin-auth';
import { listManagedUsers } from '@/lib/admin/user-management';
import { listPendingUserInvites } from '@/lib/repositories';
import { getAdminAuth } from '@/lib/firebase/admin';
import { StaffPhoneForm } from './StaffPhoneForm';
import { UserListTable } from './UserListTable';

async function listStaffPhoneUsers() {
  const auth = getAdminAuth();
  const results: { uid: string; phoneNumber: string; displayName: string }[] =
    [];
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
        results.push({
          uid: user.uid,
          phoneNumber: user.phoneNumber,
          displayName: user.displayName ?? '',
        });
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

      <UserListTable users={users} />
    </>
  );
}
