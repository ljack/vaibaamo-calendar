import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/Vaibaamo/);
});

test('navigation contains Login link when not authenticated', async ({ page }) => {
    await page.goto('/');

    // Check for "Kirjaudu / Liity" link
    const loginLink = page.getByRole('link', { name: 'Kirjaudu / Liity' });
    await expect(loginLink).toBeVisible();
});

test('can navigate to login page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Kirjaudu / Liity' }).click();

    // Expects page to have a heading with the name of Installation.
    await expect(page.getByRole('heading', { name: 'Kirjaudu Vaibaamoon' })).toBeVisible();
});
