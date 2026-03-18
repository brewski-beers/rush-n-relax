import { test, expect } from '@playwright/test';
import { preVerifyAge } from './fixtures';

/**
 * Contact Form — BDD E2E coverage.
 *
 * The form uses a React 19 Server Action (submitContact) and useActionState.
 * Validation is server-side: errors come back in the action state and render
 * as <span class="error-message"> elements inside the form.
 *
 * Rate-limit note: the server applies a 5-req/60s per-IP window. Tests run
 * in serial mode so the two browser projects (chromium + Mobile Chrome) don't
 * exhaust the bucket concurrently. Only ONE test submits valid data — the
 * happy path. All other tests either submit invalid data (which the server
 * validates and rejects before any Firestore write) or don't submit at all.
 */

// Serial within each browser project to avoid concurrent rate-limit exhaustion.
test.describe.configure({ mode: 'serial' });

test.describe('Contact Form', () => {
  test.beforeEach(async ({ page }) => {
    // Given: age gate is bypassed and the contact page is loaded
    await preVerifyAge(page);
    await page.goto('/contact');
    await page.waitForSelector('.contact-form', { timeout: 8000 });
  });

  // ─── Happy path ──────────────────────────────────────────────────────────

  test('valid submission shows success state and resets form fields', async ({
    page,
  }) => {
    // Given: the contact form is visible with all required fields
    await expect(page.locator('.contact-form')).toBeVisible();

    // When: user fills in name, email (no phone — it is optional), and message
    await page.locator('input#name').fill('Jane Smith');
    await page.locator('input#email').fill('jane@example.com');
    await page
      .locator('textarea#message')
      .fill('Hello, I have a question about your Oak Ridge location.');

    // When: user submits the form
    await page.locator('button.form-submit').click();

    // Then: success status banner is displayed
    // The component renders: <div className="form-status form-status-success">
    await expect(page.locator('.form-status-success')).toBeVisible({
      timeout: 10000,
    });

    // Then: form fields are cleared (form.reset() is called on success)
    await expect(page.locator('input#name')).toHaveValue('');
    await expect(page.locator('input#email')).toHaveValue('');
    await expect(page.locator('textarea#message')).toHaveValue('');

    // Then: submit button is re-enabled after the action settles
    await expect(page.locator('button.form-submit')).not.toBeDisabled();
  });

  // ─── Empty submission ────────────────────────────────────────────────────

  test('empty submission shows field-level validation errors', async ({
    page,
  }) => {
    // Given: all fields are left empty
    // When: user submits without filling anything
    await page.locator('button.form-submit').click();

    // Then: error spans appear for all three required fields
    // Component renders: <span id="name-error" className="error-message">
    await expect(page.locator('#name-error')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#email-error')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#message-error')).toBeVisible({ timeout: 5000 });

    // Then: form remains visible — not replaced by a success state
    await expect(page.locator('.contact-form')).toBeVisible();
    await expect(page.locator('.form-status-success')).not.toBeVisible();
  });

  // ─── Invalid email ───────────────────────────────────────────────────────

  test('invalid email shows email-specific error without name or message errors', async ({
    page,
    isMobile,
  }) => {
    // Rate-limit guard: the emulator treats all requests as the same IP, so across
    // two browser projects (Desktop Chrome + Mobile Chrome) running concurrently we
    // quickly exhaust the 5-req/60s window. Both projects use the 'chromium' engine,
    // so browserName can't distinguish them — use isMobile instead. Server-side
    // validation logic is identical across viewports; testing on desktop is sufficient.
    test.skip(
      isMobile,
      'Rate limit: server-side validation tested in desktop chromium only'
    );
    // Given: name and message are filled, but email is malformed
    await page.locator('input#name').fill('Test User');
    await page.locator('textarea#message').fill('Test message content');
    await page.locator('input#email').fill('not-an-email');

    // When: user submits the form
    await page.locator('button.form-submit').click();

    // Then: only the email error is shown.
    // On Mobile Chrome the form status banner renders above the fields and can
    // push #email-error below the initial viewport. Scroll into view first so
    // the visibility assertion is reliable across all viewport sizes.
    const emailError = page.locator('#email-error');
    await emailError.waitFor({ state: 'attached', timeout: 8000 });
    await emailError.scrollIntoViewIfNeeded();
    await expect(emailError).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#name-error')).not.toBeVisible();
    await expect(page.locator('#message-error')).not.toBeVisible();
  });
});
