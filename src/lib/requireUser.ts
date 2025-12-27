import type { User } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

export class AuthRequiredError extends Error {
    constructor(message = "Authentication required") {
        super(message);
        this.name = "AuthRequiredError";
    }
}

/**
 * Robustly returns the current user or throws AuthRequiredError.
 * - If session exists but user is null (rare), treats as unauthenticated.
 * - If getUser fails, you can decide to signOut() to clear broken state.
 */
export async function requireUser(): Promise<User> {
    const supabase = getSupabase();

    // Prefer getUser() for validated user info (it may call the API).
    // If offline, this can error; fallback to getSession().
    try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
            // Typical: "Auth session missing!" or token invalid
            throw error;
        }
        if (!data.user) throw new AuthRequiredError();
        return data.user;
    } catch {
        // Fallback: session from storage (not necessarily validated)
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user ?? null;
        if (!user) {
            // optional: clear any corrupted session state
            // await supabase.auth.signOut({ scope: "local" });
            throw new AuthRequiredError();
        }
        return user;
    }
}
