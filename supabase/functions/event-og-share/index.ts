
import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import satori from "satori";
import { initWasm, render } from "resvg";
import React from "react";

// Initialize WASM once
const wasmPromise = initWasm(fetch("https://deno.land/x/resvg_wasm@0.2.0/resvg.wasm"));

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ... existing helper functions ...

async function fetchFont() {
    // ...
    const fontUrl = "https://github.com/google/fonts/raw/main/ofl/inter/Inter-Bold.ttf";
    const res = await fetch(fontUrl);
    return await res.arrayBuffer();
}

async function getEventCTA(description: string, apiKey: string): Promise<string> {
    // ... (keep logic) ...
    if (!apiKey) return "Join the Event";
    try {
        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: "You are a marketing expert. Generate a very short, exciting, 2-5 word Call to Action (CTA) for an event based on the description. Examples: 'Join the Party', 'Register Now', 'Don't Miss Out'. Output only the CTA." },
                { role: "user", content: `Description: ${description.slice(0, 500)}` }
            ],
            model: "gpt-3.5-turbo",
            max_tokens: 10,
        });
        const cta = completion.choices[0].message.content?.trim();
        return cta ? cta.replace(/["']/g, "") : "Join the Event";
    } catch (e) {
        console.error("OpenAI Error:", e);
        return "Join the Vaibaamo";
    }
}

serve(async (req) => {
    // Ensure WASM is loaded
    await wasmPromise;

    // ... existing ...
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const eventId = url.searchParams.get("id");
        const type = url.searchParams.get("type"); // "image" for OG Image generation
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!eventId || !UUID_REGEX.test(eventId)) {
            return new Response("Invalid Event ID", { status: 400 });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
        const openaiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";

        if (!supabaseUrl || !supabaseAnonKey) {
            return new Response("Server Config Error", { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // Fetch Event Data (Public RLS)
        const { data: event, error } = await supabase
            .from("events")
            .select("*")
            .eq("id", eventId)
            .single();

        if (error || !event) {
            return new Response("Event not found", { status: 404 });
        }

        // Determine Tab and Markdown
        const tabParam = url.searchParams.get("tab") || "info";
        const ALLOWED_TABS = ["info", "plan", "recap"];
        const tab = ALLOWED_TABS.includes(tabParam) ? tabParam : "info";

        let descriptionRaw = event.description || "";
        if (tab === "recap" && event.recap_markdown) descriptionRaw = event.recap_markdown;
        else if (tab === "plan" && event.plan_markdown) descriptionRaw = event.plan_markdown;

        // --- IMAGE GENERATION MODE ---
        if (type === "image") {
            // 1. Determine Background Image URL (Reuse logic)
            let bgImageUrl = "";
            const assets = event.media_assets || [];
            const sectionImage = assets.find((a: any) => a.section === tab && a.type === "image");
            if (sectionImage) bgImageUrl = sectionImage.url;
            else {
                const anyImage = assets.find((a: any) => a.type === "image");
                if (anyImage) bgImageUrl = anyImage.url;
            }
            if (!bgImageUrl) {
                // Markdown extraction fallback
                const match = descriptionRaw.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/);
                if (match) bgImageUrl = match[1];
            }

            // 2. Generate CTA using AI (if key exists)
            const ctaText = await getEventCTA(descriptionRaw, openaiApiKey);

            // 3. Render Image with Satori
            const fontData = await fetchFont();
            
            // Standard generic background if none
             const bgStyle: any = bgImageUrl 
                ? { backgroundImage: `url(${bgImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : { background: 'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)' };

            const svg = await satori(
                React.createElement(
                    "div",
                    {
                        style: {
                            display: "flex",
                            height: "100%",
                            width: "100%",
                            flexDirection: "column",
                            justifyContent: "flex-end",
                            fontFamily: "Inter",
                            color: "white",
                            ...bgStyle,
                        },
                    },
                    React.createElement(
                        "div",
                        {
                            style: {
                                display: "flex",
                                flexDirection: "column",
                                background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)",
                                padding: "40px 60px",
                                width: "100%",
                            },
                        },
                        React.createElement("div", {
                            style: {
                                display: "flex",
                                alignItems: "center",
                                backgroundColor: "#FBBF24", // Amber button
                                color: "#111827", // Dark text
                                padding: "12px 24px",
                                borderRadius: "12px",
                                fontSize: "24px",
                                fontWeight: "bold",
                                textTransform: "uppercase",
                                marginBottom: "20px",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                                letterSpacing: "1px",
                            },
                        }, ctaText + " →"), // Visual cue arrow
                        React.createElement("div", {
                            style: {
                                fontSize: "64px",
                                fontWeight: "900", // Extra bold
                                lineHeight: "1.1",
                                textShadow: "0px 4px 20px rgba(0,0,0,0.6)",
                                letterSpacing: "-1px",
                            },
                        }, event.title)
                    )
                ),
                {
                    width: 1200,
                    height: 630,
                    fonts: [
                        {
                            name: "Inter",
                            data: fontData,
                            style: "normal",
                            weight: 700,
                        },
                    ],
                }
            );

            // 4. Convert SVG to PNG
            const pngBuffer = await render(svg);

            return new Response(pngBuffer as unknown as BodyInit, {
                headers: {
                    ...corsHeaders,
                    "Content-Type": "image/png",
                    // Cache generated image aggressively (24h)
                    "Cache-Control": "public, max-age=86400, s-maxage=86400",
                },
            });
        }

        // --- HTML MODE (Existing Logic) ---

        // Clean Description
        const cleanMarkdown = (text: string) => {
            const cleaned = text
                .replace(/!\[.*?\]\(.*?\)/g, "")
                .replace(/\[(.*?)\]\(.*?\)/g, "$1")
                .replace(/[#*`_~>]/g, "")
                .replace(/\s+/g, " ")
                .trim();
            
            const MAX_LEN = 150;
            if (cleaned.length <= MAX_LEN) return cleaned;
            let truncated = cleaned.slice(0, MAX_LEN);
            const lastSpace = truncated.lastIndexOf(" ");
            if (lastSpace > 0) truncated = truncated.slice(0, lastSpace);
            return truncated + "...";
        };

        const description = cleanMarkdown(descriptionRaw);
        
        // Use SELF as the image source (Dynamic Image)
        // We append type=image to the current URL params
        const ogImageUrl = new URL(req.url);
        ogImageUrl.searchParams.set("type", "image");
        // Ensure we pass tab to image generation so it picks correct background
        ogImageUrl.searchParams.set("tab", tab); 
        const finalOgImageUrl = ogImageUrl.toString();

        const pageTitle = `${event.title} | Vaibaamo Calendar`;

        // Redirect Logic
        let redirectUrl = url.searchParams.get("redirect");
        const ALLOWED_DOMAINS = ["vaibaamo.com", "vaibaamo-calendar.vercel.app", "localhost"];
        let isRedirectValid = false;
        if (redirectUrl) {
            try {
                const parsed = new URL(redirectUrl);
                isRedirectValid = ALLOWED_DOMAINS.some(domain => 
                    parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
                );
            } catch { isRedirectValid = false; }
        }
        if (!isRedirectValid) redirectUrl = "https://vaibaamo-calendar.vercel.app";

        if (tab !== "info" && redirectUrl) {
            try {
                const rUrl = new URL(redirectUrl);
                rUrl.searchParams.set("tab", tab);
                redirectUrl = rUrl.toString();
            } catch {}
        }

        // Generate Meta Tags
        const metaTags = `
            <title>${pageTitle}</title>
            <meta name="description" content="${description}">
            
            <meta property="og:site_name" content="Vaibaamo Calendar">
            <meta property="og:type" content="website">
            <meta property="og:url" content="${redirectUrl}">
            <meta property="og:title" content="${pageTitle}">
            <meta property="og:description" content="${description}">
            <meta property="og:image" content="${finalOgImageUrl}">

            <meta property="twitter:card" content="summary_large_image">
            <meta property="twitter:url" content="${redirectUrl}">
            <meta property="twitter:title" content="${pageTitle}">
            <meta property="twitter:description" content="${description}">
            <meta property="twitter:image" content="${finalOgImageUrl}">
        `;

        // Inject into App Shell
        let finalHtml = "";
        const canInject = redirectUrl && !redirectUrl.includes("localhost");

        if (canInject) {
            try {
                const appOrigin = new URL(redirectUrl!).origin;
                const resp = await fetch(appOrigin);
                if (resp.ok) {
                    const appHtml = await resp.text();
                    finalHtml = appHtml
                        .replace(/<title>.*?<\/title>/i, "")
                        .replace(/<\/head>/i, `${metaTags}</head>`);
                }
            } catch (e: any) {
                console.error("App shell injection failed:", e);
            }
        }

        if (!finalHtml) {
            finalHtml = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    ${metaTags}
                    <meta http-equiv="refresh" content="0;url=${redirectUrl}">
                </head>
                <body>
                    <script>window.location.href = "${redirectUrl}";</script>
                    <p>Redirecting to <a href="${redirectUrl}">${event.title}</a>...</p>
                </body>
                </html>
            `;
        }

        return new Response(finalHtml, {
            headers: {
                "Cache-Control": "public, max-age=3600, s-maxage=86400",
                ...corsHeaders,
                "Content-Type": "text/html"
            },
        });

    } catch (error: any) {
        console.error("Error:", error);
        return new Response(JSON.stringify({ 
            error: error.message,
            stack: error.stack,
            cause: error.cause
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
