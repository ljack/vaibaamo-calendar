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
        // Mock Supabase Auth: SignUp
        await page.route('**/auth/v1/signup', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    access_token: 'fake-jwt-token',
                    token_type: 'bearer',
                    expires_in: 3600,
                    refresh_token: 'fake-refresh-token',
                    user: {
                        id: 'test-user-123',
                        aud: 'authenticated',
                        role: 'authenticated',
                        email: 'test@example.com',
                        confirmed_at: new Date().toISOString(),
                    }
                })
            });
        });

        // Mock Supabase Auth: User/Session checks
        await page.route('**/auth/v1/user', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'test-user-123',
                    aud: 'authenticated',
                    role: 'authenticated',
                    email: 'test@example.com'
                })
            });
        });

        // Mock Profile/Admin check
        await page.route('**/rest/v1/profiles*', async route => {
            await route.fulfill({ status: 200, body: JSON.stringify([]) });
        });

        // Mock Passkey List (initially empty)
        await page.route('**/rest/v1/passkeys*', async route => {
            // This handles getPasskeys() -> count and list
            await route.fulfill({
                status: 200,
                headers: { 'Content-Range': '0-0/0' },
                body: JSON.stringify([])
            });
        });

        // Mock Supakeys Registration Options
        await page.route('**/functions/v1/passkey-auth/register/options', async route => {
            await route.fulfill({
                status: 200,
                body: JSON.stringify({
                    id: 'mock-challenge-id',
                    challenge: 'mock-challenge-string',
                    rp: { name: 'Vaibaamo Calendar', id: 'localhost' },
                    user: { id: 'test-user-123', name: 'test@example.com', displayName: 'test@example.com' },
                    pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
                    timeout: 60000,
                    attestation: 'none'
                })
            });
        });

        // Mock Supakeys Registration Finish
        await page.route('**/functions/v1/passkey-auth/register/finish', async route => {
            await route.fulfill({
                status: 200,
                body: JSON.stringify({ success: true, passkey: { id: 'new-passkey-id' } })
            });
        });

        // 1. Visit Login Page
        await page.goto('/login?test-mode=true'); // Assume test-mode creates a clean state if implemented

        // 2. Perform Standard Login (Email/Password or Email/MagicLink)
        await page.fill('input[data-testid="login-email-input"]', 'test-user-' + Date.now() + '@example.com');

        // Enable password mode first
        await page.check('input[data-testid="login-use-password-checkbox"]');

        // Now fill password
        await page.fill('input[data-testid="login-password-input"]', 'password123');

        // Click "Luo tili salasanalla" which appears after password mode is enabled
        await page.click('button[data-testid="signup-password-button"]');

        // Wait for redirect to dashboard/home
        await expect(page).toHaveURL('/');

        // 3. Trigger Passkey Prompt
        // The prompt appears automatically for authenticated users without passkeys.
        // We might need to wait for checks to complete.
        const promptButton = page.locator('button[data-testid="passkey-register-button"]');
        await expect(promptButton).toBeVisible({ timeout: 10000 });

        // 4. Click "Ota käyttöön" (Get Started)
        // This triggers handleRegister -> passkeyService.register() AND handleSupakeysRegister
        await promptButton.click();

        // 5. Verification
        // Since we have a Virtual Authenticator with isUserVerified: true,
        // the browser prompt "clicks itself" immediately.
        // We wait for checking the success message.
        // PasskeyPrompt shows "Avainkoodi rekisteröity onnistuneesti!" on success
        await expect(page.locator('text=Avainkoodi rekisteröity onnistuneesti')).toBeVisible();
    });
});
