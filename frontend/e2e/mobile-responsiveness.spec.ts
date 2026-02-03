import { test, expect } from '@playwright/test';

test.describe('Mobile Responsiveness', () => {
  // Set viewport to iPhone SE size
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    // Mock Auth
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user-id',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'tester@vibedigest.io',
          user_metadata: { full_name: 'Test User' }
        })
      });
    });

    // Mock API Providers to prevent loading errors
    await page.route('**/api/models/providers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ providers: [] })
      });
    });

    // Mock Chat Threads
    await page.route('**/api/chat/threads', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    // Mock DB calls
    await page.route('**/rest/v1/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        });
    });
  });

  test('should show hamburger menu and hide sidebar on mobile', async ({ page }) => {
    await page.goto('/en/chat');

    // 1. Verify desktop sidebar is HIDDEN
    // The sidebar usually is an <aside> element with classes like 'hidden md:flex'
    // Use .first() to avoid strict mode violation if multiple asides exist
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeHidden();

    // 2. Verify Hamburger menu button is VISIBLE
    const hamburgerBtn = page.getByLabel('Open menu'); // Assuming aria-label="Open menu"
    await expect(hamburgerBtn).toBeVisible();

    // 3. Click Hamburger menu
    await hamburgerBtn.click();

    // 4. Verify Drawer opens and shows navigation items
    // Using a generic text check for items usually found in the drawer
    await expect(page.getByText('Chats', { exact: true })).toBeVisible();
    await expect(page.getByText('Tasks', { exact: true })).toBeVisible();

    // 5. Click close/overlay and verify Drawer closes
    // Playwright can click the overlay or we can press Escape, or click a close button
    // Often shadcn/ui sheet has a close button with 'Close' label
    // Or we can tap the backdrop.
    // Let's try pressing Escape first as it's robust, or clicking the backdrop
    await page.keyboard.press('Escape');
    
    // Wait for animation
    await expect(page.getByText('Chats', { exact: true })).not.toBeVisible();
  });
});
