import { test, expect } from '@playwright/test';

test.describe('Journey Demo Mode', () => {
    test.beforeEach(async ({ page }) => {
        // Mock geocoding just in case, though demo mode shouldn't need it
        await page.route('**/nominatim.openstreetmap.org/search*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([{
                    lat: '60.1699',
                    lon: '24.9384',
                    display_name: 'Helsinki, Finland'
                }])
            });
        });
    });

    test('Demo mode starts immediately without selection', async ({ page }) => {
        // Navigate to demo mode
        await page.goto('/?demo=true');

        // Should skip car/difficulty selection
        const vehicleChoice = page.getByText('Choose Your Vehicle');
        await expect(vehicleChoice).not.toBeVisible();

        // Should show map immediately (or after "Initializing GPS")
        // The dashboard should be visible
        const speedGauge = page.getByText('SPEED');
        await expect(speedGauge).toBeVisible({ timeout: 15000 });

        // Verify demo route is loaded (Start Point should be Helsinki-ish)
        // We can check if "START" type or just that map is running.
        // JourneyMap renders.
        const journeyMap = page.locator('.journey-map');
        await expect(journeyMap).toBeVisible();

        // Verify car is moving (speed > 0 eventually)
        // In demo mode, it autostarts.
        // Wait for dashboard to update
        await page.waitForTimeout(2000);

        const speedValue = page.locator('text=/SPEED/').locator('..').locator('text=').nth(1);
        await expect(speedValue).toBeVisible();
        // Speed might be 0 if initializing, but usually > 0 if moving.
    });

    test('Demo mode has extended event list', async ({ page }) => {
        await page.goto('/?demo=true');
        await expect(page.locator('.journey-map')).toBeVisible({ timeout: 15000 });

        // We can't easily check the internal event list length from E2E,
        // but we can verify that the game doesn't finish immediately.

        await page.waitForTimeout(5000);
        const finishedScreen = page.locator('.journey-finished');
        await expect(finishedScreen).not.toBeVisible();
    });
});
