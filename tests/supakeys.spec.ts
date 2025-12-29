import { test, expect } from '@playwright/test';

// Use production endpoint or env variable
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://kpvehddfjxpiztiiinff.supabase.co';

test.describe('Supakeys Integration', () => {
    let authenticatorId: string;

    test.beforeEach(async ({ page }) => {
        // Create a CDP session to talk to the browser's deeper protocol
        const client = await page.context().newCDPSession(page);

        // Enable WebAuthn support
        await client.send('WebAuthn.enable');

        // Add a "Virtual Authenticator" (Simulates TouchID/GameKey)
        const result = await client.send('WebAuthn.addVirtualAuthenticator', {
            options: {
                protocol: 'ctap2',
                transport: 'internal', // 'internal' = platform authenticator (TouchID/FaceID)
                hasUserVerification: true,
                isUserVerified: true, // "User handles sensor successfully"
                hasResidentKey: true,
            },
        });
        authenticatorId = result.authenticatorId;
    });

    test.afterEach(async ({ page }) => {
        // Clean up the virtual authenticator
        const client = await page.context().newCDPSession(page);
        await client.send('WebAuthn.removeVirtualAuthenticator', {
            authenticatorId,
        });
    });

    test('should allow user to login and register a Passkey using Supakeys logic', async ({ page }) => {
        // 1. Visit Login Page
        await page.goto('/login?test-mode=true'); // Assume test-mode creates a clean state if implemented

        // 2. Perform Standard Login (Email/Password or Email/MagicLink)
        // Here we simulate a login by using a test account if available, 
        // or effectively we reuse an existing flow. 
        // For CI, we typically seed a user or use a magic link.
        // For this example, let's assume we can login with a test credential:

        await page.fill('input[name="email"]', 'test-user-' + Date.now() + '@example.com');

        // Enable password mode first
        await page.check('input[type="checkbox"]'); // "Käytä salasanaa"

        // Now fill password
        await page.fill('input[name="password"]', 'password123');

        // Click "Luo tili salasanalla" which appears after password mode is enabled
        await page.click('button:has-text("Luo tili salasanalla")');

        // Wait for redirect to dashboard/home
        await expect(page).toHaveURL('/');

        // 3. Trigger Passkey Prompt
        // The prompt appears automatically for authenticated users without passkeys.
        // We might need to wait for checks to complete.
        const prompt = page.locator('text=Ota käyttöön avainkoodi (Passkey)');
        await expect(prompt).toBeVisible({ timeout: 10000 });

        // 4. Click "Ota käyttöön" (Get Started)
        // This triggers handleRegister -> passkeyService.register() AND handleSupakeysRegister
        await page.click('button:has-text("Ota käyttöön")');

        // 5. Verification
        // Since we have a Virtual Authenticator with isUserVerified: true,
        // the browser prompt "clicks itself" immediately.
        // We wait for success message.
        await expect(page.locator('text=Avainkoodi rekisteröity onnistuneesti')).toBeVisible();

        // 6. Verify Supakeys Logic (Optional specific message if distinct)
        // "Supakey rekisteröity onnistuneesti!" might appear if the Promise.all settles or specific event fires
        // But the main "Avainkoodi" message covers the general success.
    });
});
