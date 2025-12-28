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

            // Get existing passkeys
            const { data: existingPasskeys } = await supabase
                .from("passkeys")
                .select("credential_id")
                .eq("user_id", user.id);

            const options = await SimpleWebAuthn.generateRegistrationOptions({
                rpName: "Vaibaamo Calendar",
                rpID: url.hostname === "localhost" ? "localhost" : url.hostname,
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

            const verification = await SimpleWebAuthn.verifyRegistrationResponse({
                response: body,
                expectedChallenge: challengeData.challenge,
                expectedOrigin: req.headers.get("Origin") || url.origin,
                expectedRPID: url.hostname === "localhost" ? "localhost" : url.hostname,
            });

            if (verification.verified && verification.registrationInfo) {
                const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

                const { error: saveError } = await supabase.from("passkeys").insert({
                    user_id: user.id,
                    credential_id: credentialID,
                    public_key: btoa(String.fromCharCode(...new Uint8Array(credentialPublicKey))),
                    counter,
                    transports: body.response.transports || [],
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
            const options = await SimpleWebAuthn.generateAuthenticationOptions({
                rpID: url.hostname === "localhost" ? "localhost" : url.hostname,
                userVerification: "preferred",
            });

            // Store challenge (anonymously if needed)
            const { data: challengeRecord, error: insertError } = await supabase
                .from("webauthn_challenges")
                .insert({
                    challenge: options.challenge,
                })
                .select("id")
                .single();

            if (insertError || !challengeRecord) {
                throw new Error("Failed to store challenge");
            }

            // Return challenge ID alongside options for secure lookup
            return new Response(JSON.stringify({ ...options, challengeId: challengeRecord.id }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 4. Login Verify
        if (path === "login-verify") {
            const body = await req.json();

            // Validate challengeId is provided
            if (!body.challengeId) {
                throw new Error("Challenge ID is required");
            }

            // Get challenge by ID (more secure than trusting client-provided challenge)
            const { data: challengeData, error: challengeError } = await supabase
                .from("webauthn_challenges")
                .select("challenge")
                .eq("id", body.challengeId)
                .gt("expires_at", new Date().toISOString())
                .single();

            if (challengeError || !challengeData) throw new Error("Challenge not found or expired");

            // Find passkey
            const { data: passkey, error: passkeyError } = await supabase
                .from("passkeys")
                .select("*")
                .eq("credential_id", body.id)
                .single();

            if (passkeyError || !passkey) throw new Error("Passkey not found");

            // Convert stored public key back to Uint8Array
            const publicKey = new Uint8Array(atob(passkey.public_key).split("").map(c => c.charCodeAt(0)));

            const verification = await SimpleWebAuthn.verifyAuthenticationResponse({
                response: body,
                expectedChallenge: challengeData.challenge,
                expectedOrigin: req.headers.get("Origin") || url.origin,
                expectedRPID: url.hostname === "localhost" ? "localhost" : url.hostname,
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
                await supabase.from("webauthn_challenges").delete().eq("id", body.challengeId);

                return new Response(JSON.stringify({ verified: true, ...linkData }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
            throw new Error("Verification failed");
        }

        return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
