import { test, expect } from '@playwright/test';

/**
 * Smoke tests for critical user paths.
 * These tests verify basic functionality without requiring authentication.
 */

test.describe('Landing Page', () => {
    test('loads and displays key elements', async ({ page }) => {
        await page.goto('/');

        // Check page title contains brand
        await expect(page).toHaveTitle(/Vibe|Digest/i);

        // Check hero section exists
        await expect(page.locator('h1')).toBeVisible();

        // Check for CTA/Get Started button or Login link
        const ctaButton = page.getByRole('button', { name: /start|generate|log/i }).first();
        await expect(ctaButton).toBeVisible();

        // Check for video URL input field - verify it's functional by typing into it
        // Find input in the main content area (not in nav/header)
        const urlInput = page.locator('main input, [role="main"] input, form input').first();
        await expect(urlInput).toBeVisible();

        // Verify the input is actually usable by typing into it
        await urlInput.fill('https://youtube.com/test');
        await expect(urlInput).toHaveValue('https://youtube.com/test');
    });

    test('language selector exists and works', async ({ page }) => {
        await page.goto('/');

        // Look for language selector (dropdown or button)
        const langSelector = page.locator('button[data-slot="select-trigger"]').first();
        if (await langSelector.isVisible()) {
            await langSelector.click();
            // Expect language options to appear
            const zhOption = page.getByRole('option', { name: /中文|Chinese/i });
            await expect(zhOption).toBeVisible({ timeout: 3000 });
        }
    });

    test('submitting empty URL does not navigate away', async ({ page }) => {
        await page.goto('/');

        // Click submit without entering URL
        const submitButton = page.getByRole('button', { name: /generate|start/i }).first();
        if (await submitButton.isVisible()) {
            await submitButton.click();

            // Should still be on the landing page (with any supported locale)
            await expect(page).toHaveURL(/\/(en|zh|es|fr|ja|ko|ru|pt|ar|hi)\/?$/);
        }
    });
});

test.describe('Login Page', () => {
    test('loads and displays email form', async ({ page }) => {
        await page.goto('/login');

        // Check for email input
        await expect(page.locator('input[type="email"]')).toBeVisible();

        // Check for submit button
        await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('shows error for invalid email format', async ({ page }) => {
        await page.goto('/login');

        // Enter invalid email
        await page.fill('input[type="email"]', 'invalid-email');

        // Click submit
        await page.click('button[type="submit"]');

        // HTML5 validation should prevent form submission or show error
        // The form should still be on login page
        await expect(page).toHaveURL(/\/login/);
    });
});

test.describe('Navigation', () => {
    test('locale redirect works', async ({ page }) => {
        // Visit root, should redirect to /en or detect locale
        await page.goto('/');

        // URL should contain a locale like /en or /zh
        await expect(page).toHaveURL(/\/(en|zh|es|fr|ja|ko|ru|pt|ar|hi)\/?/);
    });

    test('explore page is accessible', async ({ page }) => {
        await page.goto('/en/explore');

        // Page should load without error (no 404)
        await expect(page.locator('body')).not.toContainText('404');

        // Should have some content indicating demo or public tasks
        const heading = page.locator('h1, h2').first();
        await expect(heading).toBeVisible();
    });
});

test.describe('SEO & Metadata', () => {
    test('has correct meta description', async ({ page }) => {
        await page.goto('/');

        // Check meta description exists
        const metaDesc = page.locator('meta[name="description"]');
        await expect(metaDesc).toHaveAttribute('content', /.+/);
    });

    test('has Open Graph tags', async ({ page }) => {
        await page.goto('/');

        // Check og:title
        const ogTitle = page.locator('meta[property="og:title"]');
        await expect(ogTitle).toHaveAttribute('content', /.+/);

        // Check og:description
        const ogDesc = page.locator('meta[property="og:description"]');
        await expect(ogDesc).toHaveAttribute('content', /.+/);
    });
});
