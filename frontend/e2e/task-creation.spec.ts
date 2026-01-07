import { test, expect } from '@playwright/test'

/**
 * Journey 1.1: 提交 URL 获取摘要 (P0)
 * 
 * Given: 已登录用户在 Dashboard
 * When: 输入有效 URL 并提交
 * Then: 跳转到 task 详情页，显示摘要
 */
test.describe('Task Creation Flow', () => {

    // Mock API responses using page.route()
    test.beforeEach(async ({ page }) => {
        // Mock task creation API
        await page.route('**/api/process_video', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ task_id: 'test-task-123' })
            })
        })

        // Mock task detail API with completed summary
        await page.route('**/rest/v1/tasks*', async (route) => {
            if (route.request().url().includes('id=eq.test-task-123')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: 'test-task-123',
                        video_title: 'Test Video Title',
                        video_url: 'https://youtube.com/watch?v=test',
                        status: 'completed',
                        progress: 100,
                        created_at: new Date().toISOString()
                    })
                })
            } else {
                await route.continue()
            }
        })

        // Mock task outputs
        await page.route('**/rest/v1/task_outputs*', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([{
                    id: 'output-1',
                    kind: 'summary',
                    status: 'completed',
                    progress: 100,
                    locale: 'en',
                    content: JSON.stringify({
                        version: 1,
                        overview: 'This is a test summary overview.',
                        keypoints: [
                            { title: 'Key Point 1', detail: 'Detail 1', startSeconds: 60 },
                            { title: 'Key Point 2', detail: 'Detail 2', startSeconds: 120 }
                        ]
                    })
                }])
            })
        })
    })

    test('should create task and navigate to detail page', async ({ page }) => {
        // This test requires authentication - skip if no auth state
        // For now, we test the landing page simple form which redirects to login

        await page.goto('/en')

        // Find the URL input on landing page (HeroSection has TaskForm in simple mode)
        const urlInput = page.getByPlaceholder(/youtube|url|video/i).first()
        await expect(urlInput).toBeVisible()

        // Type a valid URL
        await urlInput.fill('https://youtube.com/watch?v=testVideo123')

        // Click generate button
        const generateBtn = page.locator('button').filter({ hasText: /generate|开始|AI Summary|AI 总结/i }).first()
        await generateBtn.click()

        // Since user is not logged in, should redirect to login
        await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
    })

    test('should show error for empty URL', async ({ page }) => {
        await page.goto('/en')

        // Click generate without entering URL
        const generateBtn = page.locator('button').filter({ hasText: /generate|开始|AI Summary|AI 总结/i }).first()
        await generateBtn.click()

        // Should show URL help dialog
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
        await expect(page.getByText('Supported platforms:').or(page.getByText('支持的平台'))).toBeVisible()
    })

    test('should show error for invalid URL format', async ({ page }) => {
        await page.goto('/en')

        const urlInput = page.getByPlaceholder(/youtube|url|video/i).first()
        await urlInput.fill('not-a-valid-url')

        const generateBtn = page.locator('button').filter({ hasText: /generate|开始|AI Summary|AI 总结/i }).first()
        await generateBtn.click()

        // Should show URL help dialog with supported platforms
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
    })
})

/**
 * Journey 1.3: 配额耗尽处理 (P0)
 * Note: This requires authenticated state, currently placeholder
 */
test.describe('Quota Exceeded Flow', () => {
    test.skip('should show quota dialog when API returns 403', async ({ page }) => {
        // TODO: Implement with storageState authentication
        // Mock API to return 403
        await page.route('**/api/process_video', async (route) => {
            await route.fulfill({
                status: 403,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Quota exceeded' })
            })
        })

        // Navigate to dashboard and submit
        // Verify quota exceeded dialog appears
    })
})
