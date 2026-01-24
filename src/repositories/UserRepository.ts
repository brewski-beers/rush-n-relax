import { collection, getDocs, query, updateDoc, doc, writeBatch, Timestamp, getDoc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFunctions$, getFirestore$ } from '@/firebase';
import type { User, UserRole } from '@/types';
import { canSeeRole, canModifyRole } from '@/config/roles';

/**
 * UserRepository - Handle all user data operations
 * Provides role-based access to user management
 */
export const UserRepository = {
  /**
   * Get all users visible to the current user based on their role
   */
  async getUsersVisibleTo(actorRole: UserRole): Promise<User[]> {
    const allUsers = await this.getAllUsers();
    return allUsers.filter(user => canSeeRole(actorRole, user.role));
  },

  /**
   * Get all users (admin only)
   */
  async getAllUsers(): Promise<User[]> {
    const usersRef = collection(getFirestore$(), 'users');
    const q = query(usersRef);
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        uid: doc.id,
        email: data.email || '',
        displayName: data.displayName || '',
        role: (data.role as UserRole) || 'customer',
        employeeId: data.employeeId || null,
        employeeStatus: data.employeeStatus || null,
        transactionAuthority: data.transactionAuthority || false,
        createdBy: data.createdBy || null,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
      } as User;
    });
  },

  /**
   * Get staff members (manager + staff roles)
   */
  async getStaffMembers(): Promise<User[]> {
    const allUsers = await this.getAllUsers();
    return allUsers.filter(u => u.role === 'staff' || u.role === 'manager' || u.role === 'admin');
  },

  /**
   * Get customers only
   */
  async getCustomers(): Promise<User[]> {
    const allUsers = await this.getAllUsers();
    return allUsers.filter(u => u.role === 'customer');
  },

  /**
   * Update user role with permission check
   */
  async updateUserRole(userId: string, newRole: UserRole, updatedBy: string, updaterRole: UserRole): Promise<void> {
    // Check if updater has permission to modify target role
    if (!canModifyRole(updaterRole, newRole)) {
      throw new Error(`You don't have permission to assign ${newRole} role`);
    }

    const userRef = doc(getFirestore$(), 'users', userId);
    // Fetch current role to enforce staff-only guest→customer promotion
    const currentSnap = await getDoc(userRef);
    const currentRole = (currentSnap.data()?.role as UserRole) || 'customer';
    const currentEmail = currentSnap.data()?.email as string | undefined;

    if (updaterRole === 'staff' && !(currentRole === 'guest' && newRole === 'customer')) {
      throw new Error('Staff can only promote guests to customers');
    }

    // Do not allow assigning customer role if no email is present
    if (newRole === 'customer' && (!currentEmail || currentEmail.trim().length === 0)) {
      throw new Error('Customers must have an email on file before assigning the customer role');
    }

    await updateDoc(userRef, {
      role: newRole,
      updatedAt: Timestamp.now(),
      updatedBy,
    });
  },

  /**
   * Bulk update user roles with permission checks
   */
  async bulkUpdateUserRoles(
    updates: { userId: string; newRole: UserRole }[],
    updaterRole: UserRole,
    updatedBy: string
  ): Promise<void> {
    // Verify all target roles can be modified by updater
    for (const { newRole } of updates) {
      if (!canModifyRole(updaterRole, newRole)) {
        throw new Error(`You don't have permission to assign ${newRole} role`);
      }
    }

    const batch = writeBatch(getFirestore$());
    
    updates.forEach(({ userId, newRole }) => {
      const userRef = doc(getFirestore$(), 'users', userId);
      batch.update(userRef, {
        role: newRole,
        updatedAt: Timestamp.now(),
        updatedBy,
      });
    });

    await batch.commit();
  },

  /**
   * Get user count by role
   */
  async getUserCountByRole(): Promise<Record<UserRole, number>> {
    const allUsers = await this.getAllUsers();
    const counts: Record<UserRole, number> = {
      guest: 0,
      admin: 0,
      manager: 0,
      staff: 0,
      customer: 0,
    };

    allUsers.forEach(user => {
      counts[user.role]++;
    });

    return counts;
  },

  /**
   * Create a guest user (staff/manager/admin)
   */
  async createGuest(
    input: {
      displayName?: string;
    },
    createdBy: string
  ): Promise<string> {
    const usersRef = collection(getFirestore$(), 'users');
    const newRef = doc(usersRef);

    const payload = {
      uid: newRef.id,
      email: '',
      displayName: input.displayName || '',
      role: 'guest' as const,
      employeeId: null,
      employeeStatus: null,
      transactionAuthority: false,
      createdBy,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(newRef, payload);
    return newRef.id;
  },

  /**
   * Invite a new user (admin/manager only)
   * Defaults to 'customer' role at lowest level
   */
  async inviteUser(email: string, role: 'customer' | 'staff' | 'manager' = 'customer', invitedBy: string): Promise<void> {
    const invite = httpsCallable(getFunctions$(), 'inviteUser');
    const res = await invite({ email, role, invitedBy });
    if (res && (res as any).data && (res as any).data.uid) {
      return;
    }
    throw new Error('Invite failed');
  },

  /**
   * Update email in Auth (source of truth) and Firestore via callable
   */
  async updateEmail(userId: string, email: string): Promise<void> {
    const updateEmailFn = httpsCallable(getFunctions$(), 'updateUserEmail');
    await updateEmailFn({ userId, email });
  },

  /**
   * Update display name with permission checks
   * Only staff and customers can update display names
   * Customers can only update their own; staff can update customers/staff below them
   */
  async updateDisplayName(
    userId: string,
    displayName: string,
    updatedBy: string,
    updaterRole: UserRole
  ): Promise<void> {
    // Only staff and customers have display name update capability
    if (updaterRole !== 'staff' && updaterRole !== 'manager' && updaterRole !== 'admin' && updaterRole !== 'customer') {
      throw new Error('Your role cannot update display names');
    }

    const userRef = doc(getFirestore$(), 'users', userId);
    const targetSnap = await getDoc(userRef);
    
    if (!targetSnap.exists()) {
      throw new Error('User not found');
    }

    const targetRole = (targetSnap.data()?.role as UserRole) || 'customer';

    // Customers can only update their own display name
    if (updaterRole === 'customer' && updatedBy !== userId) {
      throw new Error('Customers can only update their own display name');
    }

    // Staff/manager/admin can only update customers and roles below them
    if (updaterRole === 'staff' && !['customer', 'guest'].includes(targetRole)) {
      throw new Error('Staff can only update customer and guest display names');
    }

    if (updaterRole === 'manager' && !['customer', 'staff', 'guest'].includes(targetRole)) {
      throw new Error('Managers can only update customer, staff, and guest display names');
    }

    // Admin can update any role
    // (no additional check needed for admin)

    await updateDoc(userRef, {
      displayName: displayName || null,
      updatedAt: Timestamp.now(),
      updatedBy,
    });
  },
};
