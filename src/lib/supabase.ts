import { type SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

function mustGetEnv(name: string): string {
    const v = import.meta.env[name];
    if (!v || typeof v !== "string") {
        throw new Error(`Missing env var: ${name}`);
    }
    return v;
}

const SUPABASE_URL = mustGetEnv("VITE_SUPABASE_URL");
const SUPABASE_ANON_KEY = mustGetEnv("VITE_PUBLIC_SUPABASE_ANON_KEY");
const DEBUG_AUTH = String(import.meta.env.VITE_SUPABASE_DEBUG_AUTH) === "true";

/**
 * You want ONE instance globally; multiple instances can cause:
 * - duplicated refresh attempts
 * - weird onAuthStateChange behavior
 * - extra websocket connections (realtime)
 */
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
    if (_client) return _client;

    _client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            // These defaults are usually what you want in SPAs:
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true, // handles OAuth/magiclink callback URL fragments
        },
        global: {
            // optional: add global headers
            headers: {
                "X-Client-Info": "vite-spa",
            },
        },
    });

    if (DEBUG_AUTH) {
        // Log auth transitions to help debug multi-tab / refresh token issues
        _client.auth.onAuthStateChange((event, session) => {
            // Avoid logging full tokens; keep it minimal
            console.debug("[supabase auth]", event, {
                hasSession: !!session,
                userId: session?.user?.id,
                expiresAt: session?.expires_at,
            });
        });
    }

    return _client;
}

// Backward compatibility export if needed during refactor, but preferably rely on getSupabase()
export const supabase = getSupabase();
