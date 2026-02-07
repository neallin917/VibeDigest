import { test, expect } from '@playwright/test'
import { ChatPage } from './pages/ChatPage'
import { TaskPage } from './pages/TaskPage'
import { createMockTask, createMockUser, createMockTaskOutput } from './fixtures/testData'

test.describe('Complete Task Workflow (Mocked)', () => {

  test.beforeEach(async ({ page }) => {
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createMockUser())
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
        const data = createMockTask({
            status: taskStatus as any,
            progress: taskStatus === 'processing' ? 45 : 100
        });
        
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
          createMockTaskOutput('summary', {
              overview: 'AI Summary Content',
              keypoints: [{ title: 'Intro', detail: 'The beginning', startSeconds: 0 }]
          }),
          createMockTaskOutput('script', '00:00 - Intro')
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

    const chatPage = new ChatPage(page);
    const taskPage = new TaskPage(page);

    await chatPage.goto();
    await expect(chatPage.welcomeHeading).toContainText(/digest today/i);

    await chatPage.submitMessage('https://youtube.com/watch?v=dQw4w9WgXcQ');

    // Simulate navigation to task details
    await page.goto('/en/chat?task=mock-task-123');
    
    await taskPage.expectTaskCardVisible('Never Gonna Give You Up');
    
    await taskPage.expectContentVisible('AI Summary Content');
    await expect(page.getByTestId('header-key-insights')).toBeVisible()
    await expect(page.getByText('Intro').last()).toBeVisible()
  })
})
