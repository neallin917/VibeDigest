import { test, expect } from '@playwright/test'

test.describe('Complete Task Workflow (Mocked)', () => {

  test.beforeEach(async ({ page }) => {
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
      })
    })

    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: 'I have created a task for you.'
      })
    })

    let taskStatus = 'processing';
    await page.route('**/rest/v1/tasks*', async (route) => {
      const url = route.request().url();
      const isSingle = route.request().headers()['accept']?.includes('vnd.pgrst.object');
      
      if (url.includes('id=eq.mock-task-123')) {
        const data = {
          id: 'mock-task-123',
          user_id: 'test-user-id',
          video_url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
          video_title: 'Never Gonna Give You Up',
          thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
          status: taskStatus,
          progress: taskStatus === 'processing' ? 45 : 100,
          created_at: new Date().toISOString()
        };
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(isSingle ? data : [data])
        })
        if (taskStatus === 'processing') taskStatus = 'completed';
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        })
      }
    })

    await page.route('**/rest/v1/task_outputs*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { 
            kind: 'summary', 
            content: JSON.stringify({
              overview: 'AI Summary Content',
              keypoints: [{ title: 'Intro', detail: 'The beginning', startSeconds: 0 }]
            }), 
            status: 'completed' 
          },
          { kind: 'script', content: '00:00 - Intro', status: 'completed' }
        ])
      })
    })

    await page.route('**/api/models/providers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ providers: [] })
      })
    })
  })

  test('user can submit a video and see the completed results', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

    await page.goto('/en/chat')
    await expect(page.locator('h1')).toContainText(/digest today/i)

    const input = page.getByLabel('Chat input')
    await input.fill('https://youtube.com/watch?v=dQw4w9WgXcQ')
    
    const submitBtn = page.locator('button').filter({ has: page.locator('svg') }).last()
    await submitBtn.click()

    await page.goto('/en/chat?task=mock-task-123')
    
    await expect(page.getByText('Never Gonna Give You Up').first()).toBeVisible({ timeout: 10000 })
    
    await expect(page.getByText('AI Summary Content')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Key Insights')).toBeVisible()
    await expect(page.getByText('Intro').last()).toBeVisible()
  })
})
