
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0';
import {
    generateAuthenticationOptions,
    generateRegistrationOptions,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
} from 'npm:@simplewebauthn/server@11.0.0';
import {
    success,
    error,
    ApiResponse,
    SUPPORTED_ALGORITHMS,
    CHALLENGE_TTL_MINUTES,
    RATE_LIMITS,
    generateWebAuthnUserId,
    uint8ArrayToHex,
    hexToUint8Array,
} from './utils.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0';

export async function handleRegisterStart(
    supabaseAdmin: SupabaseClient,
    data: any,
    endpoint: string,
    clientIP: string,
    origin: string
): Promise<ApiResponse> {
    const { rpId, rpName, email, displayName } = data;

    const ipBlocked = await supabaseAdmin.rpc('check_passkey_rate_limit', {
        p_identifier: clientIP, p_identifier_type: 'ip', p_endpoint: endpoint, p_max_attempts: RATE_LIMITS.ip.maxAttempts
    });
    if (ipBlocked.error) {
        console.error('Rate limit check failed:', ipBlocked.error);
    } else if (ipBlocked.data) {
        return error('RATE_LIMITED', 'Too many requests');
    }

    // Check if user already exists in auth.users to maintain consistent User ID (and thus UserHandle)
    // Use robust listUsers() lookup
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    // If user exists, use their ID to generate a consistent WebAuthn User Handle.
    // Otherwise, generate a random one (new user).
    // Note: generateWebAuthnUserId() without an argument generates a random Base64URL string.
    // If an argument (like existingAuthUser.id) is provided, it returns that string directly.
    const webauthnUserId = existingAuthUser?.id || generateWebAuthnUserId();

    // We can now query for existing credentials using the stable webauthnUserId
    const { data: existingUserCreds } = await supabaseAdmin.from('passkey_credentials')
        .select('id').eq('webauthn_user_id', webauthnUserId);

    const excludeCredentials = existingUserCreds?.map((c: { id: string }) => ({
        id: c.id, type: 'public-key' as const
    })) || [];

    const options = await generateRegistrationOptions({
        rpName: rpName as string,
        rpID: rpId as string,
        userName: (displayName as string) || (email as string),
        userDisplayName: (displayName ? `${displayName} (Supakeys)` : `${email} (Supakeys)`),
        userID: new TextEncoder().encode(webauthnUserId),
        attestationType: 'none',
        excludeCredentials,
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
        supportedAlgorithmIDs: SUPPORTED_ALGORITHMS,
    });

    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60 * 1000);
    const { data: challenge } = await supabaseAdmin.from('passkey_challenges').insert({
        challenge: options.challenge, email, type: 'registration', expires_at: expiresAt.toISOString(), webauthn_user_id: webauthnUserId
    }).select().single();

    await supabaseAdmin.rpc('log_passkey_audit_event', {
        p_event_type: 'registration_started', p_email: email, p_ip_address: clientIP, p_origin: origin
    });

    return success({ options, challengeId: challenge.id });
}

export async function handleRegisterFinish(
    supabaseAdmin: SupabaseClient,
    data: any,
    challengeId: string,
    clientIP: string,
    origin: string
): Promise<ApiResponse> {
    const { rpId, response: authResponse } = data;

    const { data: challenge } = await supabaseAdmin.from('passkey_challenges')
        .select('*').eq('id', challengeId).eq('type', 'registration').single();

    await supabaseAdmin.from('passkey_challenges').delete().eq('id', challengeId);

    if (!challenge) {
        return error('CHALLENGE_MISMATCH', 'Invalid or expired challenge');
    }

    if (new Date(challenge.expires_at) < new Date()) {
        await supabaseAdmin.rpc('log_passkey_audit_event', {
            p_event_type: 'challenge_expired', p_email: challenge.email, p_ip_address: clientIP
        });
        return error('CHALLENGE_EXPIRED', 'Challenge has expired');
    }

    try {
        const verification = await verifyRegistrationResponse({
            response: authResponse as Parameters<typeof verifyRegistrationResponse>[0]['response'],
            expectedChallenge: challenge.challenge,
            expectedOrigin: origin,
            expectedRPID: rpId as string,
            supportedAlgorithmIDs: SUPPORTED_ALGORITHMS,
        });

        if (!verification.verified || !verification.registrationInfo) {
            throw new Error('Verification failed');
        }

        const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
        const publicKeyBytes = credential.publicKey;
        // Postgres bytea format
        const publicKeyHex = '\\x' + uint8ArrayToHex(publicKeyBytes);


        let userId: string;


        // Robust user lookup using Auth Admin API first
        // Note: listUsers isn't ideal for single lookup by email but it's reliable. 
        // Better might be to try createUser and catch specific error, or use listUsers with filter? 
        // listUsers doesn't support server-side filtering by email in all versions, depends on the library version.
        // We can use listUsers() and find in array, but that's inefficient for many users.
        // Let's stick to direct DB query but handle it better, or maybe we really were missing permissions?
        // Service role should have permissions.

        // Let's try to verify if the user exists by listing. 
        // Actually, the most robust way:
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users.find(u => u.email?.toLowerCase() === challenge.email.toLowerCase());

        if (existingUser) {
            userId = existingUser.id;
        } else {
            console.log(`[register-finish] User not found for ${challenge.email}, creating new user.`);
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email: challenge.email,
                email_confirm: true
            });

            if (createError || !newUser.user) {
                console.error('[register-finish] Failed to create user:', createError);
                throw new Error('Failed to create user for passkey registration');
            }
            userId = newUser.user.id;
        }

        const authenticatorName = (data as { authenticatorName?: string }).authenticatorName || null;

        const { data: insertedCred } = await supabaseAdmin.from('passkey_credentials').insert({
            id: credential.id,
            user_id: userId,
            webauthn_user_id: challenge.webauthn_user_id,
            public_key: publicKeyHex,
            counter: credential.counter,
            device_type: credentialDeviceType,
            backed_up: credentialBackedUp,
            transports: credential.transports,
            authenticator_name: authenticatorName,
        }).select().single();

        const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink', email: challenge.email
        });

        await supabaseAdmin.rpc('log_passkey_audit_event', {
            p_event_type: 'registration_completed', p_user_id: userId, p_credential_id: credential.id, p_email: challenge.email, p_ip_address: clientIP
        });

        return success({
            verified: true,
            tokenHash: linkData.properties?.hashed_token,
            passkey: insertedCred ? {
                id: insertedCred.id,
                authenticatorName: insertedCred.authenticator_name,
                deviceType: insertedCred.device_type,
                backedUp: insertedCred.backed_up,
                createdAt: insertedCred.created_at,
                lastUsedAt: insertedCred.last_used_at,
            } : null
        });
    } catch (e) {
        await supabaseAdmin.rpc('log_passkey_audit_event', {
            p_event_type: 'registration_failed', p_email: challenge.email, p_ip_address: clientIP, p_error_message: e instanceof Error ? e.message : 'Unknown'
        });
        return error('VERIFICATION_FAILED', 'Registration verification failed');
    }
}

export async function handleLoginStart(
    supabaseAdmin: SupabaseClient,
    data: any,
    endpoint: string,
    clientIP: string
): Promise<ApiResponse> {
    const { rpId, email } = data;

    const ipBlocked = await supabaseAdmin.rpc('check_passkey_rate_limit', {
        p_identifier: clientIP, p_identifier_type: 'ip', p_endpoint: endpoint, p_max_attempts: RATE_LIMITS.ip.maxAttempts
    });
    if (ipBlocked.error) {
        console.error('Rate limit check failed:', ipBlocked.error);
    } else if (ipBlocked.data) {
        return error('RATE_LIMITED', 'Too many requests');
    }

    let allowCredentials: { id: string; type: 'public-key' }[] | undefined;
    let userEmail = email as string | undefined;

    if (email) {
        const { data: user } = await supabaseAdmin
            .schema('auth')
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (!user) {
            return error('CREDENTIAL_NOT_FOUND', 'No passkey found for this email');
        }

        const { data: credentials } = await supabaseAdmin.from('passkey_credentials')
            .select('id, transports').eq('user_id', user.id);

        if (!credentials?.length) {
            return error('CREDENTIAL_NOT_FOUND', 'No passkey found for this email');
        }

        allowCredentials = credentials.map((c: any) => ({ id: c.id, type: 'public-key' as const }));
    }

    const options = await generateAuthenticationOptions({
        rpID: rpId as string,
        userVerification: 'preferred',
        allowCredentials,
    });

    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60 * 1000);
    const { data: challenge } = await supabaseAdmin.from('passkey_challenges').insert({
        challenge: options.challenge, email: userEmail, type: 'authentication', expires_at: expiresAt.toISOString()
    }).select().single();

    await supabaseAdmin.rpc('log_passkey_audit_event', {
        p_event_type: 'authentication_started', p_email: userEmail, p_ip_address: clientIP
    });

    return success({ options, challengeId: challenge.id });
}

export async function handleLoginFinish(
    supabaseAdmin: SupabaseClient,
    data: any,
    challengeId: string,
    clientIP: string,
    origin: string
): Promise<ApiResponse> {
    const { rpId, response: authResponse } = data;

    const { data: challenge } = await supabaseAdmin.from('passkey_challenges')
        .select('*').eq('id', challengeId).eq('type', 'authentication').single();

    await supabaseAdmin.from('passkey_challenges').delete().eq('id', challengeId);

    if (!challenge) {
        return error('CHALLENGE_MISMATCH', 'Invalid or expired challenge');
    }

    if (new Date(challenge.expires_at) < new Date()) {
        return error('CHALLENGE_EXPIRED', 'Challenge has expired');
    }

    const credentialId = (authResponse as { id: string }).id;
    const { data: credential, error: credError } = await supabaseAdmin.from('passkey_credentials')
        .select('*').eq('id', credentialId).single();

    if (credError || !credential) {
        return error('CREDENTIAL_NOT_FOUND', 'Credential not found');
    }

    try {
        const publicKeyHex = credential.public_key.replace('\\x', '');
        const publicKeyBytes = hexToUint8Array(publicKeyHex);

        const verification = await verifyAuthenticationResponse({
            response: authResponse as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
            expectedChallenge: challenge.challenge,
            expectedOrigin: origin,
            expectedRPID: rpId as string,
            credential: {
                id: credential.id,
                publicKey: publicKeyBytes,
                counter: credential.counter,
            },
        });

        if (!verification.verified) {
            throw new Error('Verification failed');
        }

        await supabaseAdmin.from('passkey_credentials').update({
            counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString()
        }).eq('id', credentialId);

        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(credential.user_id);
        const userEmail = userData?.user?.email || challenge.email;
        const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink', email: userEmail
        });

        await supabaseAdmin.rpc('log_passkey_audit_event', {
            p_event_type: 'authentication_completed', p_user_id: credential.user_id, p_credential_id: credentialId, p_ip_address: clientIP
        });

        return success({ verified: true, tokenHash: linkData.properties?.hashed_token, email: userEmail });
    } catch (e) {
        await supabaseAdmin.rpc('log_passkey_audit_event', {
            p_event_type: 'authentication_failed', p_credential_id: credentialId, p_ip_address: clientIP, p_error_message: e instanceof Error ? e.message : 'Unknown'
        });
        return error('VERIFICATION_FAILED', 'Authentication verification failed');
    }
}

export async function handleListPasskeys(
    supabaseAdmin: SupabaseClient,
    supabaseUrl: string,
    request: Request
): Promise<ApiResponse> {
    const authHeader = request.headers.get('Authorization');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader || '' } }
    });
    const { data: { user } } = await userClient.auth.getUser();

    if (!user) {
        return error('UNAUTHORIZED', 'Authentication required');
    }

    const { data: credentials } = await supabaseAdmin.from('passkey_credentials')
        .select('*').eq('user_id', user.id).order('created_at', { ascending: false });

    return success({
        passkeys: credentials?.map((c: any) => ({
            id: c.id, authenticatorName: c.authenticator_name, deviceType: c.device_type,
            backedUp: c.backed_up, createdAt: c.created_at, lastUsedAt: c.last_used_at
        })) || []
    });
}

export async function handleRemovePasskey(
    supabaseAdmin: SupabaseClient,
    supabaseUrl: string,
    request: Request,
    data: any,
    clientIP: string
): Promise<ApiResponse> {
    const authHeader = request.headers.get('Authorization');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader || '' } }
    });
    const { data: { user } } = await userClient.auth.getUser();

    if (!user) {
        return error('UNAUTHORIZED', 'Authentication required');
    }

    const { credentialId: removeCredId } = data as { credentialId: string };
    await supabaseAdmin.from('passkey_credentials').delete().eq('id', removeCredId).eq('user_id', user.id);

    await supabaseAdmin.rpc('log_passkey_audit_event', {
        p_event_type: 'passkey_removed', p_user_id: user.id, p_credential_id: removeCredId, p_ip_address: clientIP
    });

    return success({ removed: true });
}

export async function handleUpdatePasskey(
    supabaseAdmin: SupabaseClient,
    supabaseUrl: string,
    request: Request,
    data: any,
    clientIP: string
): Promise<ApiResponse> {
    const authHeader = request.headers.get('Authorization');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader || '' } }
    });
    const { data: { user } } = await userClient.auth.getUser();

    if (!user) {
        return error('UNAUTHORIZED', 'Authentication required');
    }

    const { credentialId: updateCredId, authenticatorName } = data as { credentialId: string; authenticatorName: string };
    const { data: updated } = await supabaseAdmin.from('passkey_credentials')
        .update({ authenticator_name: authenticatorName }).eq('id', updateCredId).eq('user_id', user.id).select().single();

    if (!updated) {
        return error('CREDENTIAL_NOT_FOUND', 'Passkey not found');
    }

    await supabaseAdmin.rpc('log_passkey_audit_event', {
        p_event_type: 'passkey_updated', p_user_id: user.id, p_credential_id: updateCredId, p_ip_address: clientIP
    });

    return success({ passkey: updated });
}
