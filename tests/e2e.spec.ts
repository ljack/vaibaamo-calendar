import { test, expect } from '@playwright/test';

test.describe('E2E Public Access', () => {
    test('Unauthenticated user can see public events on landing page', async ({ page }) => {
        // Navigate to the base URL (provided by config)
        await page.goto('/');

        // 1. Verify we are NOT logged in
        // "Kirjaudu sisään" (Log In) link should be visible
        const loginLink = page.getByRole('link', { name: /kirjaudu/i });
        await expect(loginLink).toBeVisible();

        // 2. Verify Events List is present
        // Check for the "Tulevat tapahtumat" (Upcoming Events) header
        const eventsHeader = page.getByRole('heading', { name: 'Tulevat tapahtumat', exact: true });
        await expect(eventsHeader).toBeVisible();

        // 3. Verify at least one event card is visible
        // We look for elements that look like event cards.
        // Based on the app structure, we expect some content. 
        // We can check for a known event text if data is static, or just that the list isn't empty.
        // "Ei tulevia tapahtumia" means no events. We expect actual events.

        // Wait for potential loading state first
        await expect(page.getByText(/ladataan/i)).not.toBeVisible();

        // Check that we have event items. 
        // Assuming event cards have some identifiable text or structure.
        // Let's look for known text from the previous verification "vaibaamo"
        // Or generic check for multiple articles/list items

        // Using a generous selector to find any event text content
        // We know "Järjestäjä" (Organizer) or "ilmoittaudu" (register) might be present?
        // Actually, let's just check that we don't see the "Empty" state
        // Check that we don't see the "Empty" state
        const emptyState = page.getByText(/ei tulevia tapahtumia/i);
        await expect(emptyState).not.toBeVisible();

        // Verify we have event links
        // The entire card is a link to /events/:id
        // We can look for any link that goes to an event page
        // Using a regex for the href attribute
        const eventLinks = page.locator('a[href*="/events/"]');
        await expect(eventLinks.first()).toBeVisible();
    });
});
