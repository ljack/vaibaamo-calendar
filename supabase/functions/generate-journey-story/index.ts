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
        const { events } = await req.json();

        if (!events || !Array.isArray(events)) {
            throw new Error("Events array is required");
        }

        const apiKey = Deno.env.get("OPENAI_API_KEY");
        if (!apiKey) {
            throw new Error("Server configuration error: Missing OpenAI API Key");
        }

        // Construct a prompt
        // Minimize token usage but get good results
        const eventText = events.map(e => e.message || e.title || "Something mysterious").join(", ");

        const prompt = `
        Write a 3-paragraph story in the style of the Star Wars opening crawl (e.g. "Episode VII - THE LONG ROAD").
        The story documents an epic car journey through Finland to Nuorgam.
        
        Incorporate these specific events that occurred during the journey:
        ${eventText}
        
        Make it dramatic, slightly humorous, and epic. Use uppercase for the title.
        Return ONLY the story text, paragraphs separated by newlines.
        `;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: "You are a storyteller specializing in Star Wars opening crawl style narratives." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 500
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("OpenAI API Error:", data.error);
            throw new Error(`OpenAI Error: ${data.error.message}`);
        }

        const story = data.choices[0].message.content;

        return new Response(JSON.stringify({ story }), {
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
