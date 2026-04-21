import { test, expect } from '@playwright/test';
import {
  establishAdminSession,
  exchangeSessionForActor,
  preVerifyAge,
} from './fixtures';

test.describe('Admin Login', () => {
  test('fake Google actor can establish an admin session against the Auth emulator', async ({
    page,
  }) => {
    await preVerifyAge(page);
    await page.goto('/admin/login');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Sign in' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Sign in with Google' })
    ).toBeVisible();

    await establishAdminSession(page);

    await page.goto('/admin');

    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Admin Dashboard' })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Manage Users' })
    ).toBeVisible();
  });

  test('non-owner fake actor cannot access admin dashboard', async ({
    page,
  }) => {
    await preVerifyAge(page);
    await page.goto('/admin/login');

    const response = await exchangeSessionForActor(page, {
      email: 'staff@rushnrelax.com',
      displayName: 'Staff Actor',
      providerUid: 'staff-google-oauth',
    });

    expect(response.status()).toBe(403);

    await page.goto('/admin/dashboard');

    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Sign in' })
    ).toBeVisible();
  });
});
