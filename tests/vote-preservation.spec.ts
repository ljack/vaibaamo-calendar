import { test, expect } from '@playwright/test';

test.describe('Event Vote Preservation E2E', () => {
    const eventId = '00000000-0000-0000-0000-000000000123';
    const optionId = '00000000-0000-0000-0000-000000000456';
    const userId = '00000000-0000-0000-0000-000000000002';

    // Use standardized ISO strings that will match new Date().toISOString()
    const testStartTime = new Date('2025-10-10T13:00:00Z').toISOString();
    const testEndTime = new Date('2025-10-10T15:00:00Z').toISOString();

    test.beforeEach(async ({ page }) => {
        // Capture browser console logs
        page.on('console', msg => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
        
        // Handle dialogs (alerts)
        page.on('dialog', async dialog => {
            console.log(`BROWSER DIALOG: ${dialog.message()}`);
            await dialog.dismiss();
        });

        // 1. Mock Auth
        await page.route('**/auth/v1/user', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ id: userId, email: 'test@example.com' })
            });
        });

        // 2. Mock profiles
        await page.route(url => url.pathname.includes('/rest/v1/profiles'), async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([{ id: userId, full_name: 'Test Member', role: 'admin', display_name: 'Test Member' }])
            });
        });

        // 3. Mock Events
        await page.route(url => url.pathname.includes('/rest/v1/events'), async route => {
            const method = route.request().method();
            if (method === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: eventId,
                        title: 'E2E Test Event',
                        description: 'Preserve my votes',
                        start_time: testStartTime,
                        end_time: testEndTime,
                        location: 'Test Location',
                        created_by: userId,
                        scheduler_assist: true,
                        scheduling_status: 'voting'
                    })
                });
            } else {
                await route.fulfill({ status: 204 });
            }
        });

        let deleteCalled = false;
        let insertCalled = false;

        // 4. Mock Event Options
        await page.route(url => url.pathname.includes('/rest/v1/event_options'), async route => {
            const method = route.request().method();
            console.log(`[MOCK] Event Options ${method}`);
            if (method === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([{
                        id: optionId,
                        event_id: eventId,
                        start_time: testStartTime,
                        end_time: testEndTime
                    }])
                });
            } else if (method === 'DELETE') {
                deleteCalled = true;
                await route.fulfill({ status: 204 });
            } else if (method === 'POST') {
                insertCalled = true;
                await route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify([{ id: 'new-option', event_id: eventId }])
                });
            }
        });

        // 5. Mock Event Votes
        await page.route(url => url.pathname.includes('/rest/v1/event_votes'), async route => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([{
                        id: 'vote-1',
                        option_id: optionId,
                        user_id: userId,
                        profiles: { full_name: 'Test Member', display_name: 'Test Member' }
                    }])
                });
            } else {
                await route.continue();
            }
        });

        // 6. Mock Event Owners
        await page.route(url => url.pathname.includes('/rest/v1/event_owners'), async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([{ user_id: userId }])
            });
        });

        // 7. Mock Participants
        await page.route(url => url.pathname.includes('/rest/v1/participants'), async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([{ id: 'p1', user_id: userId, event_id: eventId, status: 'registered', display_name: 'Test Member' }])
            });
        });

        // 8. Mock Passkeys
        await page.route(url => url.pathname.includes('/rest/v1/passkeys'), async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([])
            });
        });

        // 9. Mock RPC
        await page.route(url => url.pathname.includes('/rpc/'), async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([])
            });
        });

        // Store delete/insert state on the page for verification
        await page.exposeFunction('getInterceptionStats', () => ({ deleteCalled, insertCalled }));
    });

    test('votes are preserved when event is edited without changing dates', async ({ page }) => {
        const sessionData = {
            access_token: 'fake-jwt',
            refresh_token: 'fake-refresh',
            user: { id: userId, email: 'test@example.com' },
            expires_at: Math.floor(Date.now() / 1000) + 3600
        };

        const projectRef = 'kpvehddfjxpiztiiinff';
        const key = `sb-${projectRef}-auth-token`;

        await page.context().addCookies([{
            name: key,
            value: encodeURIComponent(JSON.stringify(sessionData)),
            domain: 'localhost',
            path: '/'
        }]);

        await page.addInitScript(({ key, sessionData }) => {
            window.localStorage.setItem(key, JSON.stringify(sessionData));
            // Force UTC timezone in browser for consistent ISO strings
            // (Note: This is just a helper, ideally we'd set TZ environment variable)
        }, { key, sessionData });

        await page.goto(`/events/${eventId}/edit`);
        await expect(page.getByLabel(/otsikko/i)).toHaveValue('E2E Test Event');

        const saveButton = page.getByRole('button', { name: /tallenna muutokset/i });
        await saveButton.click();

        await expect(page).toHaveURL(new RegExp(`/events/${eventId}`));

        // Wait for voter rendered
        await expect(page.getByText('Test Member').first()).toBeVisible({ timeout: 15000 });

        // Verify no destructive calls
        const stats = await page.evaluate(() => (window as any).getInterceptionStats());
        console.log('Final Stats:', stats);
        expect(stats.deleteCalled).toBe(false);
        expect(stats.insertCalled).toBe(false);
    });
});
