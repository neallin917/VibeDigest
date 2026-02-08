import { type Page } from '@playwright/test';

/**
 * Mocks common backend API responses for E2E stability.
 */
export async function setupApiMocks(page: Page, options: { isAuthenticated?: boolean } = {}) {
    const { isAuthenticated = false } = options;

    // 0. Mock Supabase Auth at window level (Init Script)
    await page.addInitScript(({ auth, session }) => {
        if (auth) {
            // Find project ref from environment if possible, or use a wild card approach
            // Here we just set a generic key that Supabase might look for if configured
            localStorage.setItem('supabase.auth.token', JSON.stringify(session));
            (window as any).__SUPABASE_MOCK_SESSION__ = session;
        } else {
            // Clear any potential session
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.includes('auth-token')) localStorage.removeItem(key);
            }
            (window as any).__SUPABASE_MOCK_SESSION__ = null;
        }
    }, { 
        auth: isAuthenticated, 
        session: {
            access_token: 'fake-jwt-token',
            user: { id: 'test-user-id', email: 'e2e@vibedigest.io', role: 'authenticated' }
        }
    });

    // 1. Mock Supabase Auth with state awareness (Network Level)
    await page.route('**/auth/v1/**', async (route) => {
        const url = route.request().url();
        
        if (url.includes('/token') || url.includes('/user') || url.includes('/session')) {
            if (isAuthenticated) {
                // Return authenticated user
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
                            email: 'e2e@vibedigest.io'
                        },
                        session: {
                            access_token: 'fake-jwt-token',
                            user: { id: 'test-user-id', email: 'e2e@vibedigest.io' }
                        }
                    })
                });
            } else {
                // Return successful NULL session (Standard Supabase Guest response)
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ 
                        data: { session: null, user: null },
                        error: null,
                        user: null,
                        session: null 
                    })
                });
            }
        } else {
            await route.continue();
        }
    });

    // 2. Mock Chat Threads API
    await page.route('**/api/chat/threads', async (route) => {
        if (route.request().method() === 'GET') {
            if (isAuthenticated) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([
                        {
                            id: 'mock-thread-1',
                            title: 'Mock Thread 1',
                            updated_at: new Date().toISOString()
                        }
                    ])
                });
            } else {
                await route.fulfill({ status: 401, body: JSON.stringify({ error: 'Unauthorized' }) });
            }
        } else {
            await route.continue();
        }
    });

    // 3. Mock Single Thread Messages API
    await page.route('**/api/chat/threads/*/messages', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([])
        });
    });

    // 4. Mock Task Discovery (Explore)
    await page.route('**/api/tasks/explore**', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([])
        });
    });
}
