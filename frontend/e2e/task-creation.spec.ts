import { test, expect } from '@playwright/test'

/**
 * Journey 1.1: Landing Page -> Chat Flow
 * 
 * Given: Anonymous user on Landing Page
 * When: Enters URL and clicks Generate
 * Then: Redirects to Login, and (in a real flow) eventually to Chat with the task.
 * 
 * Note: We cannot easily mock the full auth flow across redirects in a simple E2E 
 * without more complex setup, so we focus on the landing page interaction 
 * and the expected redirect.
 */
test.describe('Landing Page Acquisition Flow', () => {

    test('submitting URL on landing page redirects to login (if unauthenticated)', async ({ page }) => {
        await page.goto('/en')

        // Find the URL input on landing page
        const urlInput = page.getByPlaceholder(/youtube|url|video/i).first()
        await expect(urlInput).toBeVisible()

        // Type a valid URL
        await urlInput.fill('https://youtube.com/watch?v=testVideo123')

        // Click generate button
        const generateBtn = page.locator('button').filter({ hasText: /generate|开始|AI Summary|AI 总结/i }).first()
        await generateBtn.click()

        // Should redirect to login
        await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
    })

    test('should show error for empty URL', async ({ page }) => {
        await page.goto('/en')

        // Click generate without entering URL
        const generateBtn = page.locator('button').filter({ hasText: /generate|开始|AI Summary|AI 总结/i }).first()
        await generateBtn.click()

        // Should show URL help dialog or some error indication
        // The implementation might vary, but usually a dialog or toast
        await expect(page.getByRole('dialog').or(page.getByText('Supported platforms'))).toBeVisible({ timeout: 5000 })
    })

    test('should show error for invalid URL format', async ({ page }) => {
        await page.goto('/en')

        const urlInput = page.getByPlaceholder(/youtube|url|video/i).first()
        await urlInput.fill('not-a-valid-url')

        const generateBtn = page.locator('button').filter({ hasText: /generate|开始|AI Summary|AI 总结/i }).first()
        await generateBtn.click()

        // Should show URL help dialog or error
        await expect(page.getByRole('dialog').or(page.getByText('Supported platforms'))).toBeVisible({ timeout: 5000 })
    })
})
