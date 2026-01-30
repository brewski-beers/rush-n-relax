import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { AuthContextType, User } from '@/types';
import { AuthContext, useAuth, usePermission, useRequireRole } from './AuthContext';

const baseContext: AuthContextType = {
  user: null,
  isLoading: false,
  error: null,
  login: vi.fn(),
  logout: vi.fn(),
  signUp: vi.fn(),
};

const mockUser = (role: User['role']): User => ({
  uid: 'user-1',
  email: 'user@example.com',
  displayName: 'Test User',
  role,
  employeeId: null,
  employeeStatus: null,
  transactionAuthority: false,
  createdBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const withAuthProvider = (value: AuthContextType) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAuth', () => {
  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useAuth())).toThrowError(
      'useAuth must be used within AuthProvider'
    );
  });
});

describe('usePermission', () => {
  it('returns false when no user', () => {
    const wrapper = withAuthProvider(baseContext);
    const { result } = renderHook(() => usePermission('products', 'read:admin'), {
      wrapper,
    });
    expect(result.current).toBe(false);
  });

  it('returns true for admin permissions', () => {
    const wrapper = withAuthProvider({ ...baseContext, user: mockUser('admin') });
    const { result } = renderHook(() => usePermission('products', 'read'), {
      wrapper,
    });
    expect(result.current).toBe(true);
  });

  it('returns false for insufficient role', () => {
    const wrapper = withAuthProvider({ ...baseContext, user: mockUser('customer') });
    const { result } = renderHook(() => usePermission('products', 'read:admin'), {
      wrapper,
    });
    expect(result.current).toBe(false);
  });
});

describe('useRequireRole', () => {
  it('throws when user lacks role', () => {
    const wrapper = withAuthProvider({
      ...baseContext,
      user: mockUser('customer'),
      isLoading: false,
    });

    expect(() => renderHook(() => useRequireRole('admin'), { wrapper })).toThrowError(
      'requires one of these roles'
    );
  });

  it('returns user when role matches', () => {
    const user = mockUser('staff');
    const wrapper = withAuthProvider({
      ...baseContext,
      user,
      isLoading: false,
    });

    const { result } = renderHook(() => useRequireRole('staff', 'admin'), {
      wrapper,
    });
    expect(result.current).toEqual(user);
  });
});
