export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/admin-auth';
import { listManagedUsers } from '@/lib/admin/user-management';
import { UserRoleForm } from './UserRoleForm';

export default async function AdminUsersPage() {
  await requireRole('owner');
  const users = await listManagedUsers();

  return (
    <>
      <div className="admin-page-header">
        <h1>Users</h1>
      </div>
      <p className="admin-section-desc">
        Assign non-owner roles using Firebase custom claims. Owner accounts are
        immutable from this panel.
      </p>

      <UserRoleForm />

      <div className="admin-table-wrap">
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
                  No non-owner users found yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
