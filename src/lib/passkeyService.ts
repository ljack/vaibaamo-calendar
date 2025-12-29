import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { getSupabase } from './supabase';

const FUNCTION_NAME = 'auth-webauthn';

export const passkeyService = {
    /**
     * Check if the browser supports WebAuthn
     */
    isSupported: () => {
        return !!window.PublicKeyCredential &&
            !!window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable &&
            !!window.PublicKeyCredential.isConditionalMediationAvailable;
    },

    /**
     * Register a new Passkey for the current user
     */
    register: async (displayName?: string) => {
        const supabase = getSupabase();

        // 1. Get registration options from Edge Function
        const { data: regOptions, error: regError } = await supabase.functions.invoke(`${FUNCTION_NAME}/register-options`, {
            body: { displayName }
        });
        if (regError) throw regError;

        // 2. Start WebAuthn registration
        // SimpleWebAuthn v10+ expects { optionsJSON: ... }
        const attResp = await startRegistration({ optionsJSON: regOptions });

        // 3. Verify registration with Edge Function
        const { data: verification, error: verifyError } = await supabase.functions.invoke(`${FUNCTION_NAME}/register-verify`, {
            body: attResp
        });

        if (verifyError) throw verifyError;
        return verification;
    },

    /**
     * Login using an existing Passkey
     */
    login: async () => {
        const supabase = getSupabase();

        // 1. Get login options
        const { data: loginOptions, error: optionsError } = await supabase.functions.invoke(`${FUNCTION_NAME}/login-options`);
        if (optionsError) throw optionsError;

        // 2. Start WebAuthn authentication
        // SimpleWebAuthn v10+ expects { optionsJSON: ... }
        const asseResp = await startAuthentication({ optionsJSON: loginOptions });

        // 3. Verify authentication with Edge Function
        const { data: verification, error: verifyError } = await supabase.functions.invoke(`${FUNCTION_NAME}/login-verify`, {
            body: {
                credential: asseResp,
                challenge: loginOptions.challenge
            }
        });

        if (verifyError) throw verifyError;

        if (verification.verified && (verification.hashed_token || verification.email_otp)) {
            const { hashed_token, email, email_otp } = verification;

            const { data: authData, error: authError } = await supabase.auth.verifyOtp({
                email,
                token: email_otp || hashed_token,
                type: email_otp ? 'email' : 'magiclink'
            });

            if (authError) throw authError;
            return authData;
        }

        throw new Error('Login failed: Verification succeeded but no login link returned');
    },

    /**
     * List registered passkeys
     */
    list: async () => {
        const supabase = getSupabase();
        const { data, error } = await supabase.functions.invoke(`${FUNCTION_NAME}/list-passkeys`);
        if (error) throw error;
        return data.passkeys;
    },

    /**
     * Remove a passkey by ID
     */
    remove: async (id: string) => {
        const supabase = getSupabase();
        const { error } = await supabase.functions.invoke(`${FUNCTION_NAME}/remove-passkey`, {
            body: { id }
        });
        if (error) throw error;
    }
};
