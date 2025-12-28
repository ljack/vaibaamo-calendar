import { test, expect } from '@playwright/test';

// Use the production-like URL from the project config or environment
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://kpvehddfjxpiztiiinff.supabase.co';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/auth-webauthn`;

test.describe('Passkey Security', () => {
    test('register-options should reject unauthorized requests', async ({ request }) => {
        const response = await request.post(`${FUNCTION_URL}/register-options`);

        // Should return 400 or 401. Currently it returns 400 with "invalid claim"
        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('invalid claim');
    });

    test('register-verify should reject unauthorized requests', async ({ request }) => {
        const response = await request.post(`${FUNCTION_URL}/register-verify`, {
            data: { /* dummy data */ }
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('invalid claim');
    });

    test('login-options should allow anonymous requests', async ({ request }) => {
        const response = await request.post(`${FUNCTION_URL}/login-options`);

        // Login options should be public
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty('challenge');
    });
});
