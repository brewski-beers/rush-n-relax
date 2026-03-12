import { test, expect } from '@playwright/test';

test.describe('Age Gate Modal UX', () => {
  test.beforeEach(async ({ page }) => {
    // Clear all cookies so the server sees no ageVerified cookie and renders the gate
    await page.context().clearCookies();
    await page.goto('/');
    await page
      .locator('.age-gate-overlay')
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  test('displays modal in isolation without nav or footer', async ({
    page,
  }) => {
    // Age gate overlay should be visible
    const ageGateOverlay = page.locator('.age-gate-overlay');
    await expect(ageGateOverlay).toBeVisible();

    // Navigation must not be in the DOM at all — not just hidden
    const header = page.locator('.header');
    await expect(header).not.toBeAttached();

    // Age gate content card is present
    const ageGateContent = page.locator('.age-gate-content');
    await expect(ageGateContent).toBeVisible();

    // age-gate-screen is the full-viewport blocker
    const screen = page.locator('.age-gate-screen');
    const box = await screen.boundingBox();
    expect(box).toBeTruthy();
    const viewportSize = page.viewportSize();
    expect(box!.width).toBe(viewportSize!.width);
    expect(box!.height).toBe(viewportSize!.height);
  });

  test('ambient overlay portal is present during age gate', async ({
    page,
  }) => {
    // AmbientOverlay renders into #ambient-portal — must exist even before verification
    const portal = page.locator('#ambient-portal');
    await expect(portal).toBeAttached();
  });

  test('input fields are visible and not cutoff', async ({ page }) => {
    const monthInput = page.locator('input[id="month"]');
    const dayInput = page.locator('input[id="day"]');
    const yearInput = page.locator('input[id="year"]');

    // All inputs should be visible
    await expect(monthInput).toBeVisible();
    await expect(dayInput).toBeVisible();
    await expect(yearInput).toBeVisible();

    // Verify inputs are in viewport bounds (not cropped)
    const monthBox = await monthInput.boundingBox();
    const dayBox = await dayInput.boundingBox();
    const yearBox = await yearInput.boundingBox();

    expect(monthBox).toBeTruthy();
    expect(dayBox).toBeTruthy();
    expect(yearBox).toBeTruthy();

    // Verify they have reasonable width (not cutoff)
    expect(monthBox!.width).toBeGreaterThan(40);
    expect(dayBox!.width).toBeGreaterThan(40);
    expect(yearBox!.width).toBeGreaterThan(40);
  });

  test('auto-focus advances between fields on max length', async ({ page }) => {
    const monthInput = page.locator('input[id="month"]');
    const dayInput = page.locator('input[id="day"]');
    const yearInput = page.locator('input[id="year"]');

    // Focus month field and fill with 2-digit month (use fill to set value directly)
    await monthInput.focus();
    await monthInput.fill('05');

    // Day field should now be focused (after auto-focus fires)
    await page.waitForTimeout(100);
    await expect(dayInput).toBeFocused();

    // Fill day
    await dayInput.fill('15');

    // Year field should now be focused
    await page.waitForTimeout(100);
    await expect(yearInput).toBeFocused();

    // Type 3 digits only — 4 digits would trigger auto-submit and destroy the form
    await yearInput.type('199');

    // Verify all fields held their values
    await expect(monthInput).toHaveValue('05');
    await expect(dayInput).toHaveValue('15');
    await expect(yearInput).toHaveValue('199');
  });

  test('enforces max length on input fields', async ({ page }) => {
    const monthInput = page.locator('input[id="month"]');
    const dayInput = page.locator('input[id="day"]');
    const yearInput = page.locator('input[id="year"]');

    // Month max 2 digits — type one digit at a time
    await monthInput.focus();
    await monthInput.type('1');
    await monthInput.type('2');
    await monthInput.type('3'); // This 3rd digit should be ignored
    await expect(monthInput).toHaveValue('12');

    // Day max 2 digits
    await dayInput.focus();
    await dayInput.type('4');
    await dayInput.type('5');
    await dayInput.type('6'); // This 3rd digit should be ignored
    await expect(dayInput).toHaveValue('45');

    // Year max 4 digits
    await yearInput.focus();
    await yearInput.type('2');
    await yearInput.type('0');
    await yearInput.type('2');
    await yearInput.type('5');
    await yearInput.type('1'); // This 5th digit should be ignored
    await yearInput.type('9');
    await yearInput.type('9');
    await yearInput.type('9');
    const yearValue = await yearInput.inputValue();
    expect(yearValue.length).toBeLessThanOrEqual(4);
  });

  test('validates age (must be 21+)', async ({ page }) => {
    const monthInput = page.locator('input[id="month"]');
    const dayInput = page.locator('input[id="day"]');
    const yearInput = page.locator('input[id="year"]');
    const enterButton = page.locator('button:has-text("Enter")');
    const errorMessage = page.locator('.age-gate-error');

    // Today's date for age calculation
    const today = new Date();

    // Try to submit as someone who is 20 (underage)
    const underageYear = today.getFullYear() - 20;
    const underageMonth = today.getMonth() + 1;
    const underageDay = today.getDate();

    await monthInput.fill(underageMonth.toString());
    await dayInput.fill(underageDay.toString());
    await yearInput.fill(underageYear.toString());
    await enterButton.click();

    // Error message should appear
    await expect(errorMessage).toContainText(
      'You must be 21 or older to enter'
    );
  });

  test('successfully verifies age 21+', async ({ page }) => {
    const monthInput = page.locator('input[id="month"]');
    const dayInput = page.locator('input[id="day"]');
    const yearInput = page.locator('input[id="year"]');
    const ageGateOverlay = page.locator('.age-gate-overlay');
    const header = page.locator('.header');

    // Use a date that makes user 21+
    const today = new Date();
    const legalYear = today.getFullYear() - 21;
    const legalMonth = today.getMonth() + 1;
    const legalDay = 1; // Use first of month to avoid edge cases

    await monthInput.fill(legalMonth.toString());
    await dayInput.fill(legalDay.toString());
    // 4-digit year triggers auto-submit — no button click needed
    await yearInput.fill(legalYear.toString());

    // Age gate should disappear
    await expect(ageGateOverlay).not.toBeVisible();

    // Navigation should now be visible
    await expect(header).toBeVisible();
  });

  test('requires complete birth date', async ({ page }) => {
    const enterButton = page.locator('button:has-text("Enter")');
    const errorMessage = page.locator('.age-gate-error');

    // Try to submit without filling any fields
    await enterButton.click();

    // Error message should appear
    await expect(errorMessage).toContainText(
      'Please enter your complete birth date'
    );
  });

  test('validates date ranges', async ({ page }) => {
    const monthInput = page.locator('input[id="month"]');
    const dayInput = page.locator('input[id="day"]');
    const yearInput = page.locator('input[id="year"]');
    const enterButton = page.locator('button:has-text("Enter")');
    const errorMessage = page.locator('.age-gate-error');

    // Invalid month (13)
    await monthInput.type('1', { delay: 50 });
    await monthInput.type('3', { delay: 50 });
    await dayInput.type('1', { delay: 50 });
    await dayInput.type('5', { delay: 50 });
    await yearInput.type('2', { delay: 50 });
    await yearInput.type('0', { delay: 50 });
    await yearInput.type('0', { delay: 50 });
    await yearInput.type('0', { delay: 50 });

    await enterButton.click();
    await expect(errorMessage).toBeVisible({ timeout: 3000 });
    await expect(errorMessage).toContainText('Please enter a valid birth date');

    // Reload page to reset form for next test case (simpler than trying to clear React state)
    await page.reload();
    await page
      .locator('.age-gate-overlay')
      .waitFor({ state: 'visible', timeout: 5000 });

    // Invalid day (32)
    await monthInput.type('0', { delay: 50 });
    await monthInput.type('5', { delay: 50 });
    await dayInput.type('3', { delay: 50 });
    await dayInput.type('2', { delay: 50 });
    await yearInput.type('2', { delay: 50 });
    await yearInput.type('0', { delay: 50 });
    await yearInput.type('0', { delay: 50 });
    await yearInput.type('0', { delay: 50 });

    await enterButton.click();
    await expect(errorMessage).toBeVisible({ timeout: 3000 });
    await expect(errorMessage).toContainText('Please enter a valid birth date');

    // Reload page again for the third test case
    await page.reload();
    await page
      .locator('.age-gate-overlay')
      .waitFor({ state: 'visible', timeout: 5000 });

    // Invalid year (1800)
    await monthInput.type('0', { delay: 50 });
    await monthInput.type('5', { delay: 50 });
    await dayInput.type('1', { delay: 50 });
    await dayInput.type('5', { delay: 50 });
    await yearInput.type('1', { delay: 50 });
    await yearInput.type('8', { delay: 50 });
    await yearInput.type('0', { delay: 50 });
    await yearInput.type('0', { delay: 50 });

    await enterButton.click();
    await expect(errorMessage).toBeVisible({ timeout: 3000 });
    await expect(errorMessage).toContainText('Please enter a valid birth date');
  });

  test('persists age verification in cookie', async ({ page }) => {
    const today = new Date();
    const legalYear = today.getFullYear() - 21;
    await page
      .locator('input[id="month"]')
      .fill((today.getMonth() + 1).toString());
    await page.locator('input[id="day"]').fill('1');
    await page.locator('input[id="year"]').fill(legalYear.toString());
    // 4-digit year triggers auto-submit

    // Cookie should be set
    const cookies = await page.context().cookies();
    const cookie = cookies.find(c => c.name === 'ageVerified');
    expect(cookie?.value).toBe('true');

    // Reload — server reads cookie → gate does not appear
    await page.reload();
    await expect(page.locator('.age-gate-overlay')).not.toBeVisible();
    await expect(page.locator('.header')).toBeVisible();
  });

  test('auto-submits when year field is complete', async ({ page }) => {
    const today = new Date();
    const legalYear = today.getFullYear() - 21;
    await page
      .locator('input[id="month"]')
      .fill((today.getMonth() + 1).toString());
    await page.locator('input[id="day"]').fill('1');
    // Filling a 4-digit year triggers auto-submit without needing the Enter key
    await page.locator('input[id="year"]').fill(legalYear.toString());

    await expect(page.locator('.age-gate-overlay')).not.toBeVisible();
  });

  test('displays disclaimer text', async ({ page }) => {
    const disclaimer = page.locator('.age-gate-disclaimer');
    await expect(disclaimer).toContainText(
      'By entering, you certify that you are of legal age to purchase cannabis'
    );
  });
});
