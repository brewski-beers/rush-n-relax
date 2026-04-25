import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock the server actions module — useActionState needs a callable reference
// but we verify behavior via window.confirm / window.prompt spies, not action calls.
vi.mock('@/app/(admin)/admin/users/actions', () => ({
  updateUserRole: vi.fn(async () => ({ success: 'ok' })),
  addGoogleEmail: vi.fn(async () => ({ success: 'ok' })),
}));

import { UserListTable } from '@/app/(admin)/admin/users/UserListTable';
import type { ManagedUserSummary } from '@/lib/admin/user-management';

function makeUser(
  overrides: Partial<ManagedUserSummary> = {}
): ManagedUserSummary {
  return {
    uid: 'uid-123',
    email: 'user@example.com',
    displayName: 'Test User',
    role: 'customer',
    providers: ['google.com'],
    ...overrides,
  };
}

function openEditor() {
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
}

function selectRole(value: string) {
  // The role <select> is the first combobox in the edit row
  const [select] = screen.getAllByRole('combobox');
  if (!select) throw new Error('role select not found');
  fireEvent.change(select, { target: { value } });
}

function clickSaveRole() {
  fireEvent.click(screen.getByRole('button', { name: 'Save Role' }));
}

function firstPromptArg(spy: { mock: { calls: unknown[][] } }): string {
  const calls = spy.mock.calls as unknown as string[][];
  const first = calls[0];
  if (!first || typeof first[0] !== 'string') {
    throw new Error('prompt was not called with a string');
  }
  return first[0];
}

describe('UserListTable — role promotion confirmation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('customer → staff: one-click (no typed confirmation)', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const promptSpy = vi.spyOn(window, 'prompt');

    render(<UserListTable users={[makeUser({ role: 'customer' })]} />);
    openEditor();
    selectRole('staff');
    clickSaveRole();

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(promptSpy).not.toHaveBeenCalled();
  });

  it('staff → owner: requires typed email confirmation via prompt', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const promptSpy = vi
      .spyOn(window, 'prompt')
      .mockReturnValue('user@example.com');

    render(
      <UserListTable
        users={[makeUser({ role: 'staff', email: 'user@example.com' })]}
      />
    );
    openEditor();
    selectRole('owner');
    clickSaveRole();

    expect(promptSpy).toHaveBeenCalledOnce();
    const message = firstPromptArg(promptSpy);
    expect(message).toContain('user@example.com');
    expect(message).toMatch(/OWNER/);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('customer → owner: requires typed email confirmation via prompt', () => {
    const promptSpy = vi
      .spyOn(window, 'prompt')
      .mockReturnValue('user@example.com');

    render(
      <UserListTable
        users={[makeUser({ role: 'customer', email: 'user@example.com' })]}
      />
    );
    openEditor();
    selectRole('owner');
    clickSaveRole();

    expect(promptSpy).toHaveBeenCalledOnce();
    expect(firstPromptArg(promptSpy)).toContain('user@example.com');
  });

  it('owner promotion with wrong typed email does not submit', async () => {
    const { updateUserRole } = await import(
      '@/app/(admin)/admin/users/actions'
    );
    vi.spyOn(window, 'prompt').mockReturnValue('wrong@example.com');

    render(
      <UserListTable
        users={[makeUser({ role: 'staff', email: 'user@example.com' })]}
      />
    );
    openEditor();
    selectRole('owner');
    clickSaveRole();

    expect(updateUserRole).not.toHaveBeenCalled();
  });

  it('owner promotion cancelled (prompt returns null) does not submit', async () => {
    const { updateUserRole } = await import(
      '@/app/(admin)/admin/users/actions'
    );
    vi.spyOn(window, 'prompt').mockReturnValue(null);

    render(
      <UserListTable
        users={[makeUser({ role: 'customer', email: 'user@example.com' })]}
      />
    );
    openEditor();
    selectRole('owner');
    clickSaveRole();

    expect(updateUserRole).not.toHaveBeenCalled();
  });

  it('non-owner change cancelled via confirm does not submit', async () => {
    const { updateUserRole } = await import(
      '@/app/(admin)/admin/users/actions'
    );
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<UserListTable users={[makeUser({ role: 'customer' })]} />);
    openEditor();
    selectRole('staff');
    clickSaveRole();

    expect(updateUserRole).not.toHaveBeenCalled();
  });

  it('owner → customer (demotion) is one-click — not a promotion', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const promptSpy = vi.spyOn(window, 'prompt');

    render(<UserListTable users={[makeUser({ role: 'owner' })]} />);
    openEditor();
    selectRole('customer');
    clickSaveRole();

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(promptSpy).not.toHaveBeenCalled();
  });
});
