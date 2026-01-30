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

/**
 * Admin-only callable function to seed categories
 * Use this to populate initial category data
 */
export const seedCategories = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to seed data.'
    );
  }

  // Verify admin role
  try {
    const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    const userData = userDoc.data();
    
    if (userData?.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can seed data.'
      );
    }
  } catch (err) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Could not verify admin privileges.'
    );
  }

  // Check if categories already exist to avoid duplicates
  const existing = await admin.firestore().collection('categories').limit(1).get();
  if (!existing.empty) {
    return {
      success: false,
      message: 'Categories already exist. Skipping seed.',
      created: 0,
    };
  }

  // Seed categories
  const CATEGORIES = [
    {
      name: 'Flower',
      slug: 'flower',
      description: 'Premium cannabis flower strains',
      imageUrl:
        'https://images.unsplash.com/photo-1597733336794-12d05021d510?w=800&h=600&fit=crop',
      order: 1,
      isActive: true,
      seoTitle: 'Cannabis Flower | Rush N Relax',
      seoDescription: 'Browse our selection of premium cannabis flower strains.',
    },
    {
      name: 'Edibles',
      slug: 'edibles',
      description: 'Delicious cannabis-infused treats',
      imageUrl:
        'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=800&h=600&fit=crop',
      order: 2,
      isActive: true,
      seoTitle: 'Cannabis Edibles | Rush N Relax',
      seoDescription: 'Delicious cannabis-infused edibles and treats.',
    },
    {
      name: 'Vapes',
      slug: 'vapes',
      description: 'Portable vaporizers and cartridges',
      imageUrl:
        'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=800&h=600&fit=crop',
      order: 3,
      isActive: true,
      seoTitle: 'Vaporizers & Cartridges | Rush N Relax',
      seoDescription: 'High-quality vaporizers and cannabis cartridges.',
    },
    {
      name: 'Accessories',
      slug: 'accessories',
      description: 'Everything you need for a great session',
      imageUrl:
        'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=800&h=600&fit=crop',
      order: 4,
      isActive: true,
      seoTitle: 'Cannabis Accessories | Rush N Relax',
      seoDescription: 'Grinders, papers, and all your cannabis accessories.',
    },
  ];

  try {
    const batch = admin.firestore().batch();
    let created = 0;

    for (const category of CATEGORIES) {
      const docRef = admin.firestore().collection('categories').doc();
      batch.set(docRef, {
        ...category,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
      created++;
    }

    await batch.commit();

    logger.info(`Successfully seeded ${created} categories`);
    return {
      success: true,
      message: `Successfully seeded ${created} categories`,
      created,
    };
  } catch (err) {
    logger.error('Error seeding categories', { error: err });
    throw new functions.https.HttpsError(
      'internal',
      `Error seeding categories: ${err instanceof Error ? err.message : String(err)}`
    );
  }
});

/**
 * Admin-only callable function to seed products
 * Requires categories to exist first
 */
export const seedProducts = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to seed data.'
    );
  }

  // Verify admin role
  try {
    const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    const userData = userDoc.data();
    
    if (userData?.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can seed data.'
      );
    }
  } catch (err) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Could not verify admin privileges.'
    );
  }

  // Check if products already exist
  const existing = await admin.firestore().collection('products').limit(1).get();
  if (!existing.empty) {
    return {
      success: false,
      message: 'Products already exist. Skipping seed.',
      created: 0,
    };
  }

  // Verify categories exist and build map
  const categoriesSnapshot = await admin.firestore().collection('categories').get();
  if (categoriesSnapshot.empty) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'No categories found. Run seedCategories first.'
    );
  }

  const categoryMap = new Map<string, string>();
  categoriesSnapshot.forEach((doc) => {
    const catData = doc.data();
    categoryMap.set(catData.slug, doc.id);
  });

  // Product data
  const PRODUCTS = [
    // Flower
    { categorySlug: 'flower', name: 'Blue Dream', slug: 'blue-dream', description: 'A sativa-dominant hybrid with balanced effects', displayPrice: 45, cost: 28, imageUrl: 'https://images.unsplash.com/photo-1597733336794-12d05021d510?w=400&h=300&fit=crop', inventory: 15, sku: 'BD-001', thcContent: '22%', cbdContent: '1%', isActive: true, tags: ['hybrid', 'sativa', 'balanced'], notes: 'Popular strain, consistent quality', markup: 60.71 },
    { categorySlug: 'flower', name: 'OG Kush', slug: 'og-kush', description: 'Classic indica with earthy, pine flavors', displayPrice: 50, cost: 32, imageUrl: 'https://images.unsplash.com/photo-1597733336794-12d05021d510?w=400&h=300&fit=crop', inventory: 8, sku: 'OGK-001', thcContent: '24%', cbdContent: '0.5%', isActive: true, tags: ['indica', 'classic', 'earthy'], notes: 'Limited stock, reorder soon', markup: 56.25 },
    { categorySlug: 'flower', name: 'Girl Scout Cookies', slug: 'girl-scout-cookies', description: 'Sweet and earthy hybrid with strong effects', displayPrice: 55, cost: 35, imageUrl: 'https://images.unsplash.com/photo-1597733336794-12d05021d510?w=400&h=300&fit=crop', inventory: 12, sku: 'GSC-001', thcContent: '26%', cbdContent: '0.3%', isActive: true, tags: ['hybrid', 'sweet', 'potent'], notes: 'Premium strain, high demand', markup: 57.14 },
    // Edibles
    { categorySlug: 'edibles', name: 'Gummy Bears (10mg)', slug: 'gummy-bears-10mg', description: 'Fruit-flavored gummies, 10mg THC each', displayPrice: 20, cost: 8, imageUrl: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=400&h=300&fit=crop', inventory: 30, sku: 'GB-10MG-001', thcContent: '10mg per piece', cbdContent: '0%', isActive: true, tags: ['gummies', 'fruit', 'beginner-friendly'], notes: 'Best seller, restock frequently', markup: 150 },
    { categorySlug: 'edibles', name: 'Chocolate Bars (5mg)', slug: 'chocolate-bars-5mg', description: 'Dark chocolate infused with 5mg THC', displayPrice: 15, cost: 6, imageUrl: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=400&h=300&fit=crop', inventory: 45, sku: 'CB-5MG-001', thcContent: '5mg per bar', cbdContent: '0%', isActive: true, tags: ['chocolate', 'microdose', 'popular'], notes: 'High margin product', markup: 150 },
    { categorySlug: 'edibles', name: 'Peanut Butter Cups (20mg)', slug: 'peanut-butter-cups-20mg', description: 'Creamy peanut butter with dark chocolate coating', displayPrice: 25, cost: 10, imageUrl: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=400&h=300&fit=crop', inventory: 20, sku: 'PBC-20MG-001', thcContent: '20mg per cup', cbdContent: '0%', isActive: true, tags: ['peanut-butter', 'chocolate', 'premium'], notes: 'Premium edible, steady demand', markup: 150 },
    // Vapes
    { categorySlug: 'vapes', name: 'Sativa Cartridge', slug: 'sativa-cartridge', description: 'Energizing sativa blend, 1g cartridge', displayPrice: 35, cost: 18, imageUrl: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=400&h=300&fit=crop', inventory: 20, sku: 'SAT-CART-001', thcContent: '85%', cbdContent: '0%', isActive: true, tags: ['cartridge', 'sativa', 'concentrate'], notes: 'Popular morning option', markup: 94.44 },
    { categorySlug: 'vapes', name: 'Indica Cartridge', slug: 'indica-cartridge', description: 'Relaxing indica blend, 1g cartridge', displayPrice: 35, cost: 18, imageUrl: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=400&h=300&fit=crop', inventory: 25, sku: 'IND-CART-001', thcContent: '87%', cbdContent: '0%', isActive: true, tags: ['cartridge', 'indica', 'concentrate'], notes: 'Evening favorite', markup: 94.44 },
    { categorySlug: 'vapes', name: 'Hybrid Blend Cartridge', slug: 'hybrid-blend-cartridge', description: 'Balanced hybrid cartridge, 1g', displayPrice: 40, cost: 20, imageUrl: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=400&h=300&fit=crop', inventory: 15, sku: 'HYB-CART-001', thcContent: '90%', cbdContent: '0%', isActive: true, tags: ['cartridge', 'hybrid', 'concentrate', 'premium'], notes: 'Premium concentrate, higher margin', markup: 100 },
    // Accessories
    { categorySlug: 'accessories', name: 'Herb Grinder (4-piece)', slug: 'herb-grinder-4piece', description: '4-piece aluminum grinder with kief catcher', displayPrice: 25, cost: 10, imageUrl: 'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=400&h=300&fit=crop', inventory: 50, sku: 'GR-4P-001', thcContent: '0%', cbdContent: '0%', isActive: true, tags: ['grinder', 'aluminum', 'kief-catcher'], notes: 'Best seller in accessories', markup: 150 },
    { categorySlug: 'accessories', name: 'Rolling Papers Pack', slug: 'rolling-papers-pack', description: 'Premium rolling papers, 50-pack', displayPrice: 5, cost: 1.5, imageUrl: 'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=400&h=300&fit=crop', inventory: 200, sku: 'RP-50-001', thcContent: '0%', cbdContent: '0%', isActive: true, tags: ['papers', 'rolling', 'consumable'], notes: 'High volume, low margin', markup: 233.33 },
    { categorySlug: 'accessories', name: 'Glass Tips (25-pack)', slug: 'glass-tips-25pack', description: 'Reusable glass filter tips', displayPrice: 8, cost: 3, imageUrl: 'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=400&h=300&fit=crop', inventory: 100, sku: 'GT-25-001', thcContent: '0%', cbdContent: '0%', isActive: true, tags: ['tips', 'glass', 'filters'], notes: 'Eco-friendly option', markup: 166.67 },
    { categorySlug: 'accessories', name: 'Smell-Proof Container', slug: 'smell-proof-container', description: 'Airtight stash container with locking lid', displayPrice: 15, cost: 6, imageUrl: 'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=400&h=300&fit=crop', inventory: 30, sku: 'SP-CONT-001', thcContent: '0%', cbdContent: '0%', isActive: true, tags: ['container', 'storage', 'discrete'], notes: 'Quality accessory, steady demand', markup: 150 },
  ];

  try {
    const batch = admin.firestore().batch();
    let created = 0;

    for (const product of PRODUCTS) {
      const categoryId = categoryMap.get(product.categorySlug);
      if (!categoryId) {
        logger.warn(`Skipping product ${product.name}: category not found`);
        continue;
      }

      const docRef = admin.firestore().collection('products').doc();
      const { categorySlug, ...productData } = product;
      
      batch.set(docRef, {
        ...productData,
        categoryId,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
      created++;
    }

    await batch.commit();

    logger.info(`Successfully seeded ${created} products`);
    return {
      success: true,
      message: `Successfully seeded ${created} products`,
      created,
    };
  } catch (err) {
    logger.error('Error seeding products', { error: err });
    throw new functions.https.HttpsError(
      'internal',
      `Error seeding products: ${err instanceof Error ? err.message : String(err)}`
    );
  }
});
