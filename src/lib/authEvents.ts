import { getSupabase } from "./supabase";

export function listenToAuthEvents(onChange: (event: string) => void): () => void {
    const supabase = getSupabase();
    const DEBUG_AUTH = String(import.meta.env.VITE_SUPABASE_DEBUG_AUTH) === "true";

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        // events: SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY, etc.
        if (DEBUG_AUTH) {
            console.debug("[authEvents] onAuthStateChange", {
                event,
                hasSession: !!session,
                userId: session?.user?.id,
                expiresAt: session?.expires_at,
            });
        }
        onChange(event);
    });

    return () => sub.subscription.unsubscribe();
}
