import { test as setup, expect } from '@playwright/test';
import { AuthPage } from './pages/AuthPage';

const authFile = 'playwright/.auth/user.json';

/**
 * Auth Setup - 登录测试账户并保存 Session
 * 
 * 此脚本会在需要认证的测试之前运行，保存登录态到 storageState
 */
setup('authenticate', async ({ page }) => {
    // Mock Supabase Auth Token Endpoint
    await page.route('**/auth/v1/token*', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                access_token: 'fake-jwt-token',
                token_type: 'bearer',
                expires_in: 3600,
                refresh_token: 'fake-refresh-token',
                user: {
                    id: 'test-user-id',
                    aud: 'authenticated',
                    role: 'authenticated',
                    email: 'e2e@vibedigest.io',
                    email_confirmed_at: new Date().toISOString(),
                    last_sign_in_at: new Date().toISOString(),
                    app_metadata: { provider: 'email', providers: ['email'] },
                    user_metadata: { full_name: 'E2E Test User' },
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            })
        });
    });

    const authPage = new AuthPage(page);

    // 1. 导航到登录页
    await authPage.gotoLogin();

    // 2. 等待页面加载
    await page.waitForLoadState('domcontentloaded');

    // 3-6. Perform Login using Page Object
    // Use defaults if env vars missing
    const email = process.env.TEST_USER_EMAIL || 'e2e@vibedigest.io';
    const password = process.env.TEST_USER_PASSWORD || 'password123';
    
    await authPage.login(email, password);

    // 7. 等待登录成功 - 跳转到 dashboard 或首页
    await expect(page).toHaveURL(/\/(dashboard|chat|en\/?$)/, { timeout: 15000 });

    // 8. 保存登录状态到文件
    await page.context().storageState({ path: authFile });

    console.log('✅ Authentication successful (mocked), state saved to', authFile);
});
