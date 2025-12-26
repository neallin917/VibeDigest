import { test, expect } from '@playwright/test';

test('landing page loads and has login button', async ({ page }) => {
    // 1. Visit Home
    await page.goto('/');

    // 2. Check Title or Key Text
    // Using a loose check for "Vibe" or brand name
    await expect(page).toHaveTitle(/Vibe|Digest/i);

    // 3. Check for Login Link/Button
    // The landing page has a big "Get Started" button linking to /login
    // It contains text "Get Started" (or English fallback)
    const ctaButton = page.getByRole('button', { name: /start|Log/i }).first();
    await expect(ctaButton).toBeVisible();
});

test('login page loads', async ({ page }) => {
    await page.goto('/login');

    // Expect email input field
    // Use generic input type selector if label/placeholder is dynamic
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // Expect submit button "Sign In with Email" or similar
    // The form has a button with type="submit"
    await expect(page.locator('button[type="submit"]')).toBeVisible();
});
