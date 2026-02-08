import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('Landing Page visual check', async ({ page }, testInfo) => {
    // Visual regression snapshots are platform-specific (darwin vs linux differ in fonts/rendering).
    // Run locally only to update baselines: npx playwright test --update-snapshots
    test.skip(!!process.env.CI, 'Visual regression snapshots must be generated per-platform locally');

    // Visit Landing Page
    await page.goto('/en');

    // Wait for Hero to be visible
    await expect(page.locator('h1')).toBeVisible();

    // Take screenshot and compare
    // Note: This will fail on the first run. 
    // Run `npx playwright test --update-snapshots` to generate the baseline.
    await expect(page).toHaveScreenshot('landing-page.png', {
      maxDiffPixels: 100, // Allow minor pixel differences
      fullPage: true
    });
  });
});
