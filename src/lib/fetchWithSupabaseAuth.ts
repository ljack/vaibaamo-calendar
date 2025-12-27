import { getSupabase } from "./supabase";

export async function fetchWithSupabaseAuth(input: RequestInfo, init: RequestInit = {}) {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();

    const accessToken = data.session?.access_token;

    const headers = new Headers(init.headers);
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

    const res = await fetch(input, { ...init, headers });

    if (res.status === 401) {
        // token invalid/expired AND refresh didn't save you (revoked, etc.)
        // Clear local session to avoid infinite loops.
        try {
            await supabase.auth.signOut({ scope: "local" });
        } catch {
            // ignore
        }
    }

    return res;
}
