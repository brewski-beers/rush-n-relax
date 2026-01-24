import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { getAuth$, getFirestore$ } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { User, AuthContextType, UserRole } from '@/types';

const AuthContext = createContext<AuthContextType | null>(null);

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Session timeout configuration (in milliseconds)
  // Elevated roles (staff/manager/admin) have shorter timeout for security
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes for regular users
  const ELEVATED_SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes for staff+
  const INACTIVITY_WARNING_MS = 2 * 60 * 1000; // Warn 2 minutes before timeout

  // Initialize auth state from Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth$(), async (firebaseUser) => {
      try {
        if (firebaseUser) {
          console.log('[Auth] Firebase user authenticated:', {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
          });

          // Get custom claims from ID token
          const idTokenResult = await firebaseUser.getIdTokenResult();
          const customRole = (idTokenResult.claims.role as UserRole) || 'customer';
          console.log('[Auth] Custom claims role:', customRole);

          // Fetch user document from Firestore
          const userRef = doc(getFirestore$(), 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            console.log('[Auth] Existing user document found:', userData);
            
            // Update role from custom claims if different
            const roleFromClaims = customRole;
            if (userData.role !== roleFromClaims) {
              console.log('[Auth] Updating user role from claims:', { old: userData.role, new: roleFromClaims });
              await setDoc(userRef, { role: roleFromClaims, updatedAt: new Date() }, { merge: true });
            }
            
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              role: roleFromClaims,
              employeeId: userData.employeeId || null,
              employeeStatus: userData.employeeStatus || null,
              transactionAuthority: userData.transactionAuthority || false,
              createdBy: userData.createdBy || null,
              createdAt: userData.createdAt?.toDate?.() || new Date(),
              updatedAt: userData.updatedAt?.toDate?.() || new Date(),
            });
          } else {
            // First login - create user document with role from claims
            console.log('[Auth] Creating new user document...');
            const newUser: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              role: customRole,
              employeeId: null,
              employeeStatus: null,
              transactionAuthority: false,
              createdBy: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            console.log('[Auth] Prepared user data with role from claims:', newUser);
            console.log('[Auth] Writing to users/' + firebaseUser.uid);
            await setDoc(userRef, newUser);
            console.log('[Auth] User document created successfully');
            setUser(newUser);
          }
        } else {
          console.log('[Auth] No Firebase user (logged out)');
          setUser(null);
        }
        setError(null);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Auth initialization failed';
        console.error('[Auth] Error during auth state change:', {
          message: errorMessage,
          code: err instanceof Error && 'code' in err ? (err as any).code : undefined,
          details: err instanceof Error ? err.stack : undefined,
        });
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // Session timeout effect - auto-logout for inactivity (especially important for elevated roles)
  useEffect(() => {
    if (!user) return;

    const isElevatedRole = ['staff', 'manager', 'admin'].includes(user.role);
    const timeoutMs = isElevatedRole ? ELEVATED_SESSION_TIMEOUT_MS : SESSION_TIMEOUT_MS;
    let inactivityTimer: NodeJS.Timeout;
    let warningTimer: NodeJS.Timeout;

    const resetTimers = () => {
      clearTimeout(inactivityTimer);
      clearTimeout(warningTimer);

      // Set warning timer (2 min before timeout)
      warningTimer = setTimeout(() => {
        console.warn('[Auth] Session about to expire due to inactivity', {
          role: user.role,
          timeoutIn: INACTIVITY_WARNING_MS / 1000,
        });
      }, timeoutMs - INACTIVITY_WARNING_MS);

      // Set inactivity logout timer
      inactivityTimer = setTimeout(async () => {
        console.warn('[Auth] Auto-logout due to inactivity', {
          role: user.role,
          inactiveFor: timeoutMs / 60 / 1000,
        });
        try {
          await signOut(getAuth$());
          setUser(null);
          setError('Session expired due to inactivity. Please log in again.');
        } catch (err) {
          console.error('[Auth] Error during auto-logout:', err);
        }
      }, timeoutMs);
    };

    // Track user activity (mouse, keyboard, touch)
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'click'];
    const handleActivity = () => {
      console.debug('[Auth] User activity detected');
      resetTimers();
    };

    // Attach event listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    // Initialize timers
    resetTimers();

    // Cleanup on unmount or user change
    return () => {
      clearTimeout(inactivityTimer);
      clearTimeout(warningTimer);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [user]);

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);
      console.log('[Auth] Signing in with email:', email);
      await signInWithEmailAndPassword(getAuth$(), email, password);
      console.log('[Auth] Sign-in successful');
      // User state will be updated by onAuthStateChanged listener
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Login failed';
      console.error('[Auth] Login error:', {
        message: errorMessage,
        code: err instanceof Error && 'code' in err ? (err as any).code : undefined,
      });
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await signOut(getAuth$());
      setUser(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Logout failed';
      setError(errorMessage);
      throw err;
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName: string
  ) => {
    try {
      setError(null);
      setIsLoading(true);

      console.log('[Auth] Creating account with email:', email);
      const result = await createUserWithEmailAndPassword(getAuth$(), email, password);
      console.log('[Auth] Account created, uid:', result.user.uid);

      // Create user document in Firestore
      const userRef = doc(getFirestore$(), 'users', result.user.uid);
      const newUser: User = {
        uid: result.user.uid,
        email,
        displayName,
        role: 'customer',
        employeeId: null,
        employeeStatus: null,
        transactionAuthority: false,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log('[Auth] Writing user document:', newUser);
      await setDoc(userRef, newUser);
      console.log('[Auth] User document created successfully');
      setUser(newUser);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Sign up failed';
      console.error('[Auth] Sign-up error:', {
        message: errorMessage,
        code: err instanceof Error && 'code' in err ? (err as any).code : undefined,
      });
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, error, login, logout, signUp }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 * Throws if used outside AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// Export both context and provider for proper HMR handling
export { AuthContext, AuthProvider };

/**
 * Hook to check if user has a specific permission
 */
export function usePermission(resource: string, action: string) {
  const { user } = useAuth();

  if (!user) {
    return false;
  }

  const permissions = {
    guest: [
      'products:read',
      'categories:read',
    ],
    customer: [
      'products:read',
      'categories:read',
      'orders:read:own',
      'orders:create',
    ],
    staff: [
      'products:read',
      'categories:read',
      'orders:read',
      'orders:update',
      'users:read',
    ],
    manager: [
      'products:read',
      'products:create',
      'products:update',
      'categories:read',
      'categories:create',
      'categories:update',
      'orders:read',
      'orders:update',
      'users:read',
      'users:update',
    ],
    admin: [
      'products:read',
      'products:create',
      'products:update',
      'products:delete',
      'categories:read',
      'categories:create',
      'categories:update',
      'categories:delete',
      'orders:read',
      'orders:update',
      'users:read',
      'users:create',
      'users:update',
      'users:delete',
    ],
  };

  const userPermissions = permissions[user.role] || [];
  const permissionKey = `${resource}:${action}`;

  return userPermissions.includes(permissionKey);
}

/**
 * Hook to require a specific role
 * Throws error if user doesn't have required role
 */
export function useRequireRole(...roles: UserRole[]) {
  const { user, isLoading } = useAuth();

  if (!isLoading && (!user || !roles.includes(user.role))) {
    throw new Error(
      `This action requires one of these roles: ${roles.join(', ')}`
    );
  }

  return user;
}
