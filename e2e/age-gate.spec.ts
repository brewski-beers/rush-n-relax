import { test, expect, Page } from '@playwright/test';

test.describe('Age Gate Modal UX', () => {
  test.beforeEach(async ({ page }) => {
    // Clear age verification to force modal
    await page.context().addCookies([]);
    await page.evaluate(() => localStorage.removeItem('ageVerified'));
    await page.goto('/');
    // Wait for modal to be interactive, not entire page load
    await page.locator('.age-gate-overlay').waitFor({ state: 'visible', timeout: 5000 });
  });

  test('displays modal in isolation without nav or footer', async ({ page }) => {
    // Age gate overlay should be visible
    const ageGateOverlay = page.locator('.age-gate-overlay');
    await expect(ageGateOverlay).toBeVisible();

    // Navigation should NOT be visible during age gate
    const header = page.locator('.header');
    await expect(header).not.toBeVisible();

    // Footer should NOT be visible during age gate
    const footer = page.locator('.footer');
    await expect(footer).not.toBeVisible();

    // Modal content should be centered
    const ageGateContent = page.locator('.age-gate-content');
    await expect(ageGateContent).toBeVisible();
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

    // Focus month field and type 2-digit month
    await monthInput.focus();
    await monthInput.type('05');

    // Day field should now be focused
    await expect(dayInput).toBeFocused();

    // Type day
    await dayInput.type('15');

    // Year field should now be focused
    await expect(yearInput).toBeFocused();

    // Type year
    await yearInput.type('1995');

    // Verify all fields have correct values
    await expect(monthInput).toHaveValue('5');
    await expect(dayInput).toHaveValue('15');
    await expect(yearInput).toHaveValue('1995');
  });

  test('enforces max length on input fields', async ({ page }) => {
    const monthInput = page.locator('input[id="month"]');
    const dayInput = page.locator('input[id="day"]');
    const yearInput = page.locator('input[id="year"]');

    // Month max 2 digits
    await monthInput.focus();
    await monthInput.type('123');
    await expect(monthInput).toHaveValue('12'); // Should cap at 12

    // Day max 2 digits
    await dayInput.focus();
    await dayInput.type('456');
    await expect(dayInput).toHaveValue('45'); // Should cap at 2 digits

    // Year max 4 digits
    await yearInput.focus();
    await yearInput.type('20251999');
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
    await expect(errorMessage).toContainText('You must be 21 or older to enter');
  });

  test('successfully verifies age 21+', async ({ page }) => {
    const monthInput = page.locator('input[id="month"]');
    const dayInput = page.locator('input[id="day"]');
    const yearInput = page.locator('input[id="year"]');
    const enterButton = page.locator('button:has-text("Enter")');
    const ageGateOverlay = page.locator('.age-gate-overlay');
    const header = page.locator('.header');

    // Use a date that makes user 21+
    const today = new Date();
    const legalYear = today.getFullYear() - 21;
    const legalMonth = today.getMonth() + 1;
    const legalDay = 1; // Use first of month to avoid edge cases

    await monthInput.fill(legalMonth.toString());
    await dayInput.fill(legalDay.toString());
    await yearInput.fill(legalYear.toString());
    await enterButton.click();

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
    await expect(errorMessage).toContainText('Please enter your complete birth date');
  });

  test('validates date ranges', async ({ page }) => {
    const monthInput = page.locator('input[id="month"]');
    const dayInput = page.locator('input[id="day"]');
    const yearInput = page.locator('input[id="year"]');
    const enterButton = page.locator('button:has-text("Enter")');
    const errorMessage = page.locator('.age-gate-error');

    // Invalid month (13)
    await monthInput.fill('13');
    await dayInput.fill('15');
    await yearInput.fill('2000');
    await enterButton.click();

    await expect(errorMessage).toContainText('Please enter a valid birth date');

    // Clear and try invalid day (32)
    await errorMessage.waitFor({ state: 'hidden' });
    await monthInput.fill('05');
    await dayInput.fill('32');
    await yearInput.fill('2000');
    await enterButton.click();

    await expect(errorMessage).toContainText('Please enter a valid birth date');

    // Clear and try invalid year
    await errorMessage.waitFor({ state: 'hidden' });
    await monthInput.fill('05');
    await dayInput.fill('15');
    await yearInput.fill('1800');
    await enterButton.click();

    await expect(errorMessage).toContainText('Please enter a valid birth date');
  });

  test('persists age verification in localStorage', async ({ page }) => {
    const monthInput = page.locator('input[id="month"]');
    const dayInput = page.locator('input[id="day"]');
    const yearInput = page.locator('input[id="year"]');
    const enterButton = page.locator('button:has-text("Enter")');

    // Verify age
    const today = new Date();
    const legalYear = today.getFullYear() - 21;
    await monthInput.fill((today.getMonth() + 1).toString());
    await dayInput.fill('1');
    await yearInput.fill(legalYear.toString());
    await enterButton.click();

    // Check localStorage
    const ageVerified = await page.evaluate(() => localStorage.getItem('ageVerified'));
    expect(ageVerified).toBe('true');

    // Reload page - age gate should not appear
    await page.reload();
    const ageGateOverlay = page.locator('.age-gate-overlay');
    await expect(ageGateOverlay).not.toBeVisible();

    // Navigation should be visible immediately
    const header = page.locator('.header');
    await expect(header).toBeVisible();
  });

  test('handles Enter key submission', async ({ page }) => {
    const monthInput = page.locator('input[id="month"]');
    const dayInput = page.locator('input[id="day"]');
    const yearInput = page.locator('input[id="year"]');
    const ageGateOverlay = page.locator('.age-gate-overlay');

    // Fill and press Enter on year field
    const today = new Date();
    const legalYear = today.getFullYear() - 21;
    await monthInput.fill((today.getMonth() + 1).toString());
    await dayInput.fill('1');
    await yearInput.fill(legalYear.toString());
    await yearInput.press('Enter');

    // Age gate should disappear
    await expect(ageGateOverlay).not.toBeVisible();
  });

  test('displays disclaimer text', async ({ page }) => {
    const disclaimer = page.locator('.age-gate-disclaimer');
    await expect(disclaimer).toContainText('By entering, you certify that you are of legal age to purchase cannabis');
  });
});
