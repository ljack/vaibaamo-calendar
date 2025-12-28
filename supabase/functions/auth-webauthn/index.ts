import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import * as SimpleWebAuthn from "https://esm.sh/@simplewebauthn/server@10.0.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    try {
        // 1. Register Options
        if (path === "register-options") {
            const userRes = await supabase.auth.getUser(authHeader?.split(" ")[1]);
            if (userRes.error) throw userRes.error;
            const user = userRes.data.user;

            const origin = req.headers.get("Origin") || url.origin;
            const originUrl = new URL(origin);
            const rpID = originUrl.hostname === "localhost" ? "localhost" : originUrl.hostname;

            // Get existing passkeys
            const { data: existingPasskeys } = await supabase
                .from("passkeys")
                .select("credential_id")
                .eq("user_id", user.id);

            const options = await SimpleWebAuthn.generateRegistrationOptions({
                rpName: "Vaibaamo Calendar",
                rpID,
                userID: new TextEncoder().encode(user.id),
                userName: user.email!,
                attestationType: "none",
                excludeCredentials: existingPasskeys?.map((pk) => ({
                    id: pk.credential_id,
                    type: "public-key",
                })),
                authenticatorSelection: {
                    residentKey: "preferred",
                    userVerification: "preferred",
                },
            });

            // Store challenge
            await supabase.from("webauthn_challenges").insert({
                user_id: user.id,
                challenge: options.challenge,
            });

            return new Response(JSON.stringify(options), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 2. Register Verify
        if (path === "register-verify") {
            const body = await req.json();
            const userRes = await supabase.auth.getUser(authHeader?.split(" ")[1]);
            if (userRes.error) throw userRes.error;
            const user = userRes.data.user;

            // Retrieve challenge
            const { data: challengeData, error: challengeError } = await supabase
                .from("webauthn_challenges")
                .select("challenge")
                .eq("user_id", user.id)
                .gt("expires_at", new Date().toISOString())
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

            if (challengeError || !challengeData) throw new Error("Challenge not found or expired");

            const origin = req.headers.get("Origin") || url.origin;
            const originUrl = new URL(origin);
            const rpID = originUrl.hostname === "localhost" ? "localhost" : originUrl.hostname;

            const verification = await SimpleWebAuthn.verifyRegistrationResponse({
                response: body,
                expectedChallenge: challengeData.challenge,
                expectedOrigin: origin,
                expectedRPID: rpID,
            });

            if (verification.verified && verification.registrationInfo) {
                const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

                const { error: saveError } = await supabase.from("passkeys").insert({
                    user_id: user.id,
                    credential_id: SimpleWebAuthn.isoBase64.fromUint8Array(credentialID),
                    public_key: btoa(String.fromCharCode(...new Uint8Array(credentialPublicKey))),
                    counter,
                    transports: body.response.transports || [],
                    rp_id: rpID,
                    origin: origin,
                });

                if (saveError) throw saveError;

                // Cleanup challenge
                await supabase.from("webauthn_challenges").delete().eq("user_id", user.id);

                return new Response(JSON.stringify({ verified: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
            throw new Error("Verification failed");
        }

        // 3. Login Options
        if (path === "login-options") {
            const origin = req.headers.get("Origin") || url.origin;
            const originUrl = new URL(origin);
            const rpID = originUrl.hostname === "localhost" ? "localhost" : originUrl.hostname;

            const options = await SimpleWebAuthn.generateAuthenticationOptions({
                rpID,
                userVerification: "preferred",
            });

            // Store challenge (anonymously if needed)
            await supabase.from("webauthn_challenges").insert({
                challenge: options.challenge,
            });

            return new Response(JSON.stringify(options), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 4. Login Verify
        if (path === "login-verify") {
            const body = await req.json();
            const { credential, challenge } = body;

            if (!credential || !challenge) {
                throw new Error("Missing credential or challenge in request");
            }

            // Get challenge
            const { data: challengeData, error: challengeError } = await supabase
                .from("webauthn_challenges")
                .select("challenge")
                .eq("challenge", challenge)
                .gt("expires_at", new Date().toISOString())
                .single();

            if (challengeError || !challengeData) throw new Error("Challenge not found or expired");

            const origin = req.headers.get("Origin") || url.origin;
            const originUrl = new URL(origin);
            const rpID = originUrl.hostname === "localhost" ? "localhost" : originUrl.hostname;

            // Find passkey
            const { data: passkey, error: passkeyError } = await supabase
                .from("passkeys")
                .select("*")
                .eq("credential_id", credential.id)
                .eq("rp_id", rpID)
                .single();

            if (passkeyError || !passkey) throw new Error("Passkey not found for this host");

            // Convert stored public key back to Uint8Array
            const publicKey = new Uint8Array(atob(passkey.public_key).split("").map(c => c.charCodeAt(0)));

            const verification = await SimpleWebAuthn.verifyAuthenticationResponse({
                response: credential,
                expectedChallenge: challengeData.challenge,
                expectedOrigin: origin,
                expectedRPID: rpID,
                authenticator: {
                    credentialID: passkey.credential_id,
                    credentialPublicKey: publicKey,
                    counter: passkey.counter,
                },
            });

            if (verification.verified) {
                // Update counter
                await supabase
                    .from("passkeys")
                    .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
                    .eq("id", passkey.id);

                // Generate Login Token
                const { data: userData, error: userError } = await supabase.auth.admin.getUserById(passkey.user_id);
                if (userError) throw userError;

                const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
                    type: "magiclink",
                    email: userData.user.email!,
                });

                if (linkError) throw linkError;

                // Cleanup challenge
                await supabase.from("webauthn_challenges").delete().eq("challenge", challengeData.challenge);

                return new Response(JSON.stringify({ verified: true, ...linkData }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
            throw new Error("Verification failed");
        }

        return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
