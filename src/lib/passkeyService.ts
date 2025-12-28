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
    register: async () => {
        const supabase = getSupabase();

        try {
            // 1. Get registration options from Edge Function
            const { data: regOptions, error: regError } = await supabase.functions.invoke(`${FUNCTION_NAME}/register-options`);
            if (regError) throw regError;

            // 2. Start WebAuthn registration
            const attResp = await startRegistration(regOptions);

            // 3. Verify registration with Edge Function
            const { data: verification, error: verifyError } = await supabase.functions.invoke(`${FUNCTION_NAME}/register-verify`, {
                body: attResp
            });

            if (verifyError) throw verifyError;
            return verification;
        } catch (error) {
            // Handle specific WebAuthn errors
            if (error instanceof Error) {
                if (error.name === 'NotAllowedError') {
                    throw new Error('Passkey-rekisteröinti peruutettiin tai aikakatkaistu');
                } else if (error.name === 'InvalidStateError') {
                    throw new Error('Tämä passkey on jo rekisteröity');
                } else if (error.name === 'NotSupportedError') {
                    throw new Error('Selaimesi ei tue tätä passkey-tyyppiä');
                }
            }
            throw error;
        }
    },

    /**
     * Login using an existing Passkey
     */
    login: async () => {
        const supabase = getSupabase();

        try {
            // 1. Get login options
            const { data: loginOptions, error: optionsError } = await supabase.functions.invoke(`${FUNCTION_NAME}/login-options`);
            if (optionsError) throw optionsError;
            if (!loginOptions) throw new Error('Failed to get login options');

            // Extract challengeId for verification
            const { challengeId, ...webAuthnOptions } = loginOptions;
            if (!challengeId) throw new Error('Challenge ID not provided by server');

            // 2. Start WebAuthn authentication
            const asseResp = await startAuthentication(webAuthnOptions);

            // 3. Verify authentication with Edge Function, including challengeId
            const { data: verification, error: verifyError } = await supabase.functions.invoke(`${FUNCTION_NAME}/login-verify`, {
                body: { ...asseResp, challengeId }
            });

            if (verifyError) throw verifyError;

            if (verification.verified && verification.properties?.action_link) {
                // The Edge Function returns a magic link token hash or full link
                // We can use supabase.auth.verifyOtp to sign in if it's a token_hash,
                // or just redirect if it's a full link.
                // My Edge Function returned linkData from admin.generateLink.

                const { hashed_token, email } = verification.properties;

                const { data: authData, error: authError } = await supabase.auth.verifyOtp({
                    email,
                    token: hashed_token,
                    type: 'magiclink'
                });

                if (authError) throw authError;
                return authData;
            }

            throw new Error('Login failed: Verification succeeded but no login link returned');
        } catch (error) {
            // Handle specific WebAuthn errors
            if (error instanceof Error) {
                if (error.name === 'NotAllowedError') {
                    throw new Error('Kirjautuminen peruutettiin tai aikakatkaistu');
                } else if (error.name === 'NotSupportedError') {
                    throw new Error('Selaimesi ei tue passkey-kirjautumista');
                }
            }
            throw error;
        }
    }
};
