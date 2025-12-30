import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { events, mode = 'story', route } = await req.json();

        if (!events || !Array.isArray(events)) {
            throw new Error("Events array is required");
        }

        const apiKey = Deno.env.get("OPENAI_API_KEY");
        if (!apiKey) {
            throw new Error("Server configuration error: Missing OpenAI API Key");
        }

        let prompt = "";
        let systemRole = "";

        if (mode === 'title') {
            // Generate a single witty title for the first event
            const eventDesc = events[0]?.message || "A mysterious occurrence";
            prompt = `
             Generate a short, funny, and punchy title (max 5 words) for this event encountered on a car journey in Lapland:
             "${eventDesc}"
             
             Examples:
             - "Reindeer Roadblock"
             - "The Great Bladder Emergency"
             - "Aurora Borealis? At this time of day?"
             
             Return ONLY the title, no quotes.
             `;
            systemRole = "You are a witty copywriter.";
        } else {
            // Default Story Mode
            const eventText = events.map((e: any) => e.message || e.title || "Something mysterious").join(", ");
            const routeText = route && Array.isArray(route) ? route.join(" -> ") : "a mysterious path";

            prompt = `
            Write a 3-paragraph story in the style of the Star Wars opening crawl (e.g. "Episode VII - THE LONG ROAD").
            The story documents an epic car journey across Finland, visiting these locations in order: ${routeText}.

            MANDATORY: You MUST mention specific details or "juicy" fictional events that happened at the locations listed in the route (e.g., "The slippery ice tracks of Oulu", "The reindeer blockade of Rovaniemi").
            
            Also incorporate these specific random encounters that occurred:
            ${eventText}
            
            Make it dramatic, slightly humorous, and epic. Use uppercase for the title.
            Return ONLY the story text, paragraphs separated by newlines.
            `;
            systemRole = "You are a storyteller specializing in Star Wars opening crawl style narratives. You weave distinct locations and random events into a cohesive, epic saga.";
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: systemRole },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7,
                max_tokens: mode === 'title' ? 50 : 500
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("OpenAI API Error:", data.error);
            throw new Error(`OpenAI Error: ${data.error.message}`);
        }

        const content = data.choices[0].message.content.trim();

        return new Response(JSON.stringify({ [mode]: content }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("Error in generate-journey-story:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
