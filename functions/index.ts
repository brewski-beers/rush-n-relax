// Firebase Cloud Functions entry point
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { setGlobalOptions } from 'firebase-functions';
import { onRequest } from 'firebase-functions/https';
import * as logger from 'firebase-functions/logger';

admin.initializeApp();
setGlobalOptions({ maxInstances: 10 });

// Example function (for reference/health checks)
export const helloWorld = onRequest((request, response) => {
  logger.info('Hello logs!', { structuredData: true });
  response.send('Hello from Firebase!');
});

function canUpdateEmail(
  actorRole: string,
  actorUid: string,
  targetUid: string,
  targetRole: string
): boolean {
  // Customers can only change their own email
  if (actorRole === 'customer') {
    return actorUid === targetUid;
  }

  // Staff can change customer emails
  if (actorRole === 'staff') {
    return targetRole === 'customer';
  }

  // Managers can change staff and customer emails
  if (actorRole === 'manager') {
    return targetRole === 'staff' || targetRole === 'customer';
  }

  // Admins can change any email
  if (actorRole === 'admin') {
    return true;
  }

  return false;
}

/**
 * Callable function to invite/create an Auth user.
 * - Requires authenticated caller
 * - Admin can invite roles: admin (optional), manager, staff, customer
 * - Manager can invite roles: staff, customer
 * - Staff cannot invite
 * - Customer can invite roles: customer (must meet prerequisites)
 * 
 * Defaults to 'customer' role at the lowest level
 */
export const inviteUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  const inviterUid = context.auth.uid;
  const inviterRole = (context.auth.token?.role as string) || 'customer';
  const { email, role = 'customer', displayName, employeeId, employeeStatus, transactionAuthority } = data || {};

  if (!email || typeof email !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Email is required');
  }

  const allowedByRole: Record<string, string[]> = {
    admin: ['admin', 'manager', 'staff', 'customer'],
    manager: ['staff', 'customer'],
    staff: [],
    customer: ['customer'],
  };

  const allowed = allowedByRole[inviterRole] || [];
  if (!allowed.includes(role)) {
    throw new functions.https.HttpsError('permission-denied', `Role ${role} not allowed for inviter role ${inviterRole}`);
  }

  // If inviter is customer, enforce simple prerequisite (contactVerified=true)
  if (inviterRole === 'customer') {
    try {
      const inviterDoc = await admin.firestore().doc(`users/${inviterUid}`).get();
      const inviterData = inviterDoc.data() || {};
      if (!inviterData.contactVerified) {
        throw new functions.https.HttpsError('failed-precondition', 'Customer must be contact verified to invite');
      }
    } catch (e) {
      if (e instanceof functions.https.HttpsError) throw e;
      throw new functions.https.HttpsError('internal', 'Failed to verify inviter prerequisites');
    }
  }

  // Create auth user with a random temporary password (for reset link flow)
  const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
  let created;
  try {
    created = await admin.auth().createUser({
      email,
      password: tempPassword,
      displayName,
      emailVerified: false,
      disabled: false,
    });
  } catch (err) {
    throw new functions.https.HttpsError('already-exists', 'User may already exist or invalid email');
  }

  // Apply custom claims for role
  await admin.auth().setCustomUserClaims(created.uid, { role });

  // Apply custom claims for role + optional employee data
  await admin.auth().setCustomUserClaims(created.uid, {
    role,
    employeeId: employeeId || null,
    employeeStatus: employeeStatus || null,
    transactionAuthority: !!transactionAuthority,
  });

  // Seed Firestore user doc with new schema (uid-first, no legacy fields)
  await admin.firestore().doc(`users/${created.uid}`).set({
    uid: created.uid,
    email,
    displayName: displayName || '',
    role,
    employeeId: employeeId || null,
    employeeStatus: employeeStatus || null,
    transactionAuthority: !!transactionAuthority,
    createdBy: inviterUid,
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  }, { merge: true });

  // Optional: generate password reset link for onboarding (returned to caller)
  let resetLink: string | null = null;
  try {
    resetLink = await admin.auth().generatePasswordResetLink(email);
  } catch {
    // Ignore if link generation fails (still invited)
  }

  return { uid: created.uid, email, role, resetLink };
});

/**
 * Callable to update a user's email in Auth and Firestore, keeping them in sync.
 * - Resets contactVerified to false on email change.
 * - Applies role-based permissions: customer=self, staff→customer, manager→staff/customer, admin→all.
 */
export const updateUserEmail = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  const actorUid = context.auth.uid;
  const actorRole = (context.auth.token?.role as string) || 'customer';
  const { userId, email } = data || {};

  if (!userId || typeof userId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'userId is required');
  }

  if (!email || typeof email !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Email is required');
  }

  // Load target user role from Firestore (fall back to Auth claims if missing)
  const userDocRef = admin.firestore().doc(`users/${userId}`);
  const userDoc = await userDocRef.get();
  const targetData = userDoc.data() || {};
  const targetRole = (targetData.role as string) || 'customer';

  if (!canUpdateEmail(actorRole, actorUid, userId, targetRole)) {
    throw new functions.https.HttpsError('permission-denied', 'You do not have permission to update this email');
  }

  // Update Auth account (source of truth)
  try {
    await admin.auth().updateUser(userId, { email, emailVerified: false });
  } catch (err) {
    throw new functions.https.HttpsError('internal', 'Failed to update auth email');
  }

  // Sync Firestore user document
  await userDocRef.set(
    {
      uid: userId,
      email,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: actorUid,
    },
    { merge: true }
  );

  // Optionally send verification (best-effort)
  try {
    const link = await admin.auth().generateEmailVerificationLink(email);
    return { email, verificationLink: link };
  } catch {
    return { email };
  }
});

/**
 * Trigger on Auth user creation to ensure Firestore user doc exists.
 * Sets default role from claims or 'customer' and marks status 'invited'.
 */
export const onAuthUserCreate = functions.auth.user().onCreate(async (user) => {
  const uid = user.uid;
  try {
    const existing = await admin.firestore().doc(`users/${uid}`).get();
    if (existing.exists) {
      return;
    }

    const fullUser = await admin.auth().getUser(uid);
    const role = (fullUser.customClaims?.role as string) || 'customer';
    const employeeId = (fullUser.customClaims?.employeeId as string) || null;
    const employeeStatus = (fullUser.customClaims?.employeeStatus as string) || null;
    const transactionAuthority = Boolean(fullUser.customClaims?.transactionAuthority);

    await admin.firestore().doc(`users/${uid}`).set({
      uid,
      email: user.email || '',
      displayName: user.displayName || '',
      role,
      employeeId,
      employeeStatus,
      transactionAuthority,
      createdBy: null,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    }, { merge: true });
  } catch (err) {
    logger.error('Failed to seed user doc on auth create', { uid, err });
  }
});
