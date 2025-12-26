import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

export type AuthState = {
    session: Session | null;
    user: User | null;
    initialized: boolean;
    error?: string;
    timedOut?: boolean;
};

/**
 * Ensures:
 * - detectSessionInUrl has a chance to run
 * - storage session is loaded
 * - we don't block forever if browser/network is weird
 */
export async function initAuthOnce(timeoutMs = 4000): Promise<AuthState> {
    const supabase = getSupabase();
    const DEBUG_AUTH = String(import.meta.env.VITE_SUPABASE_DEBUG_AUTH) === "true";
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const elapsedMs = () => {
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        return Math.round(now - startedAt);
    };

    const timeout = new Promise<AuthState>((resolve) => {
        setTimeout(() => {
            console.warn("[authBootstrap] Session check timed out, defaulting to null", {
                elapsedMs: elapsedMs(),
                timeoutMs,
            });
            resolve({
                session: null,
                user: null,
                initialized: true,
                error: "Auth check timed out",
                timedOut: true,
            });
        }, timeoutMs);
    });

    const normal = (async (): Promise<AuthState> => {
        try {
            // getSession is safe; it will reflect URL-detected session too (after detectSessionInUrl)
            const { data, error } = await supabase.auth.getSession();
            if (error && DEBUG_AUTH) {
                console.error("[authBootstrap] getSession error", error);
            }
            const resolvedMs = elapsedMs();
            const hasSession = !!data.session;
            if (resolvedMs > timeoutMs) {
                console.warn("[authBootstrap] getSession resolved after timeout", {
                    hasSession,
                    elapsedMs: resolvedMs,
                    timeoutMs,
                });
            } else if (DEBUG_AUTH) {
                console.log("[authBootstrap] getSession resolved", {
                    hasSession,
                    elapsedMs: resolvedMs,
                });
            }
            return {
                session: data.session ?? null,
                user: data.session?.user ?? null,
                initialized: true,
                error: error?.message,
                timedOut: false,
            };
        } catch (e: any) {
            if (DEBUG_AUTH) {
                console.error("[authBootstrap] getSession threw", {
                    message: e?.message,
                    name: e?.name,
                    stack: e?.stack,
                });
            }
            return {
                session: null,
                user: null,
                initialized: true,
                error: e?.message ?? "Unknown auth init error",
                timedOut: false,
            };
        }
    })();

    // whichever resolves first
    return Promise.race([normal, timeout]);
}
