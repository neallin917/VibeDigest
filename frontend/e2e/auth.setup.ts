import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

/**
 * Auth Setup - 登录测试账户并保存 Session
 * 
 * 此脚本会在需要认证的测试之前运行，保存登录态到 storageState
 */
setup('authenticate', async ({ page }) => {
    // 1. 导航到登录页
    await page.goto('/en/login');

    // 2. 等待页面加载
    await page.waitForLoadState('domcontentloaded');

    // 3. 切换到密码登录模式 (登录页默认是 Magic Link 模式)
    const passwordModeButton = page.getByRole('button', { name: /Sign in with Password/i });
    if (await passwordModeButton.isVisible({ timeout: 5000 })) {
        await passwordModeButton.click();
    }

    // 4. 等待密码输入框出现
    await expect(page.getByPlaceholder('Password')).toBeVisible({ timeout: 5000 });

    // 5. 输入测试账户凭据
    await page.getByPlaceholder('name@example.com').fill(process.env.TEST_USER_EMAIL || '');
    await page.getByPlaceholder('Password').fill(process.env.TEST_USER_PASSWORD || '');

    // 6. 点击登录按钮
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // 7. 等待登录成功 - 跳转到 dashboard 或首页
    await expect(page).toHaveURL(/\/(dashboard|en\/?$)/, { timeout: 15000 });

    // 8. 保存登录状态到文件
    await page.context().storageState({ path: authFile });

    console.log('✅ Authentication successful, state saved to', authFile);
});
