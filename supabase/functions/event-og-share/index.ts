
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
    // Input Validation & Allowlisting
    const url = new URL(req.url);
    const eventId = url.searchParams.get("id");
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!eventId || !UUID_REGEX.test(eventId)) {
        return new Response("Invalid Event ID", { status: 400 });
    }

    const tabParam = url.searchParams.get("tab") || "info";
    const ALLOWED_TABS = ["info", "plan", "recap"];
    const tab = ALLOWED_TABS.includes(tabParam) ? tabParam : "info";

    // Validate Redirect URL to prevent Open Redirect vulnerabilities
    let redirectUrl = url.searchParams.get("redirect");
    const ALLOWED_DOMAINS = ["vaibaamo.com", "vaibaamo-calendar.vercel.app", "localhost"];
    
    let isRedirectValid = false;
    if (redirectUrl) {
        try {
            const parsed = new URL(redirectUrl);
            isRedirectValid = ALLOWED_DOMAINS.some(domain => 
                parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
            );
        } catch {
            isRedirectValid = false;
        }
    }

    if (!isRedirectValid) {
        // Fallback to a safe default if redirect param is missing or malicious
        redirectUrl = "https://vaibaamo-calendar.vercel.app";
    }

    // Append tab to redirect URL so the user lands on the correct tab
    if (tab !== "info" && redirectUrl) {
        try {
            const rUrl = new URL(redirectUrl);
            rUrl.searchParams.set("tab", tab);
            redirectUrl = rUrl.toString();
        } catch {
            // If parsing fails (unlikely given validation), leave as is
        }
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

    // Fetch Event Data (Read-Only)
    const { data: event, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

    if (error || !event) {
        console.error("Event fetch error:", error);
        return new Response(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${redirectUrl}"></head></html>`, {
            headers: { "Content-Type": "text/html" },
        });
    }

    // Determine Image
    let imageUrl = "";
    const assets = event.media_assets || [];
    
    // Priority 1: Structured Asset from the requested section
    const sectionImage = assets.find((a: any) => a.section === tab && a.type === "image");
    if (sectionImage) {
        imageUrl = sectionImage.url;
    } else {
            // Priority 2: Any Structured Asset
            const anyImage = assets.find((a: any) => a.type === "image");
            if (anyImage) imageUrl = anyImage.url;
    }

    // Priority 3 (Fallback): Extract from Markdown content
    if (!imageUrl) {
        const extractImage = (md: string) => {
            if (!md) return null;
            const match = md.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/); // Capture https? URLs only
            return match ? match[1] : null;
        }

        // Check current tab first, then others
        const currentMarkdown = tab === 'recap' ? event.recap_markdown : (tab === 'plan' ? event.plan_markdown : "");
        imageUrl = extractImage(currentMarkdown) || 
                   extractImage(event.recap_markdown) || 
                   extractImage(event.plan_markdown) || "";
    }

    // Determine Description
    let description = event.description || "";
    const cleanMarkdown = (text: string) => {
        return text
            // Remove images: ![alt](url)
            .replace(/!\[.*?\]\(.*?\)/g, "")
            // Remove links but keep text: [text](url) -> text
            .replace(/\[(.*?)\]\(.*?\)/g, "$1")
            // Remove bold/italic/code markers: #, *, _, `, ~, >
            .replace(/[#*`_~>]/g, "")
            // Collapse whitespace
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 200) + "...";
    };

    if (tab === "recap" && event.recap_markdown) {
        description = cleanMarkdown(event.recap_markdown);
    } else if (tab === "plan" && event.plan_markdown) {
        description = cleanMarkdown(event.plan_markdown);
    }

    // Construct HTML response
    // Generate Meta Tags
    const metaTags = `
        <title>${event.title}</title>
        <meta name="description" content="${description}">
        
        <!-- Open Graph / Facebook -->
        <meta property="og:site_name" content="Vaibaamo Calendar">
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
    `;

    // Attempt to inject into App Shell (Masking) to show the actual app content
    let finalHtml = "";
    const canInject = redirectUrl && !redirectUrl.includes("localhost");

    if (canInject) {
        try {
            const appOrigin = new URL(redirectUrl!).origin;
            // Fetch the App Shell (index.html)
            const resp = await fetch(appOrigin);
            if (resp.ok) {
                const appHtml = await resp.text();
                // Inject tags: Remove existing title and append new tags to head
                finalHtml = appHtml
                    .replace(/<title>.*?<\/title>/i, "")
                    .replace(/<\/head>/i, `${metaTags}</head>`);
            }
        } catch (e: any) {
            console.error("App shell injection failed:", e);
        }
    }

    // Fallback: Minimal JS Redirect (for localhost or fetch failure)
    if (!finalHtml) {
        finalHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                ${metaTags}
                <!-- Redirect to App -->
                <meta http-equiv="refresh" content="0;url=${redirectUrl}">
            </head>
            <body>
                <script>window.location.href = "${redirectUrl}";</script>
                <p>Redirecting to <a href="${redirectUrl}">${event.title}</a>...</p>
            </body>
            </html>
        `;
    }

    // Cache Aggressively: Public content, cache for 1 hour (CDN 24 hours)
    // This acts as a rate limit by offloading requests to the edge cache.
    const cacheHeaders = {
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        ...corsHeaders,
        "Content-Type": "text/html"
    };

    return new Response(finalHtml, {
        headers: cacheHeaders,
    });

    } catch (error: any) {
        console.error("Edge function error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
