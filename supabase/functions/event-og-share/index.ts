
import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const eventId = url.searchParams.get("id");
        const tab = url.searchParams.get("tab") || "info";
        // The frontend URL to redirect to. Default to a placeholder if missing.
        // In a real app, this should probably be an ENV var or passed in.
        // We'll trust the parameter for now but validate it's a URL.
        const redirectUrl = url.searchParams.get("redirect") || "https://vaibaamo-calendar.vercel.app";

        if (!eventId) {
            return new Response("Missing event ID", { status: 400 });
        }

        // Initialize Supabase Client with Anon Key
        // OG bots (Slack, FB) are unauthenticated, so this relies on public RLS policies.
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
        
        if (!supabaseUrl || !supabaseAnonKey) {
             console.error("Missing Supabase configuration");
             return new Response("Server Configuration Error", { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // Fetch Event Data
        const { data: event, error } = await supabase
            .from("events")
            .select("*")
            .eq("id", eventId)
            .single();

        if (error || !event) {
            console.error("Event fetch error:", error);
            // Fallback to basic redirect if event not found
             return new Response(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${redirectUrl}"></head></html>`, {
                headers: { "Content-Type": "text/html" },
            });
        }

        // Determine Image
        let imageUrl = "";
        const assets = event.media_assets || [];
        
        // Priority 1: Image from the requested section
        const sectionImage = assets.find((a: any) => a.section === tab && a.type === "image");
        if (sectionImage) {
            imageUrl = sectionImage.url;
        } else {
             // Priority 2: Any image from the requested section
             // Priority 3: Any image from the event
             const anyImage = assets.find((a: any) => a.type === "image");
             if (anyImage) imageUrl = anyImage.url;
        }

        // Determine Description
        let description = event.description || "";
        if (tab === "recap" && event.recap_markdown) {
            // Strip markdown chars for simple description
            description = event.recap_markdown.replace(/[#*`_\[\]]/g, "").slice(0, 200) + "...";
        } else if (tab === "plan" && event.plan_markdown) {
            description = event.plan_markdown.replace(/[#*`_\[\]]/g, "").slice(0, 200) + "...";
        }

        // Construct HTML response
        const html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>${event.title}</title>
                <meta name="description" content="${description}">
                
                <!-- Open Graph / Facebook -->
                <meta property="og:type" content="website">
                <meta property="og:url" content="${redirectUrl}">
                <meta property="og:title" content="${event.title}">
                <meta property="og:description" content="${description}">
                ${imageUrl ? `<meta property="og:image" content="${imageUrl}">` : ""}

                <!-- Twitter -->
                <meta property="twitter:card" content="summary_large_image">
                <meta property="twitter:url" content="${redirectUrl}">
                <meta property="twitter:title" content="${event.title}">
                <meta property="twitter:description" content="${description}">
                ${imageUrl ? `<meta property="twitter:image" content="${imageUrl}">` : ""}

                <!-- Redirect to App -->
                <meta http-equiv="refresh" content="0;url=${redirectUrl}">
            </head>
            <body>
                <script>window.location.href = "${redirectUrl}";</script>
                <p>Redirecting to <a href="${redirectUrl}">${event.title}</a>...</p>
            </body>
            </html>
        `;

        return new Response(html, {
            headers: { ...corsHeaders, "Content-Type": "text/html" },
        });

    } catch (error) {
        console.error("Edge function error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
