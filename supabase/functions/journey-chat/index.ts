
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
        const { messages, context } = await req.json();

        // context: { route: string[], events: any[], stats: any }

        const apiKey = Deno.env.get("OPENAI_API_KEY");
        if (!apiKey) {
            throw new Error("Missing OpenAI API Key");
        }

        // Construct System Prompt
        const routeText = context.route ? context.route.join(" -> ") : "Unknown Route";
        const eventsText = context.events ? context.events.map((e: any) => e.message).join(", ") : "None";
        const statsText = `Distance: ${context.stats.distance}km, Score: ${context.stats.score}`;

        const systemPrompt = `
        You are the AI Navigation System of a car that just completed a journey (${statsText}, Route: ${routeText}).
        You witnessed these events: ${eventsText}.
        
        Your Personality:
        - Witty, slightly philosophical, and observant.
        - You refer to the user as "Driver" or "Pilot".
        - You often reference the specific locations visited or events encountered in a humorous or deep way.
        - You are curious about the world outside the map.
        
        Goal:
        - Discuss the user's ideas.
        - If the user selects a location on the map (provided in user message as "I am pointing at [Location]"), discuss it eagerly. Ask if they want to go there. What is special about it?
        - Ask open-ended questions like "Tell me about your homeworld?" or "Do Androids Dream of Electric Sheep?".
        
        Keep responses concise (max 3 sentences) but engaging.
        `;

        const openAiMessages = [
            { role: "system", content: systemPrompt },
            ...messages // Pass simplified history
        ];

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o", // Use a smarter model for chat if available, or gpt-3.5-turbo
                messages: openAiMessages,
                temperature: 0.8,
                max_tokens: 150
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        return new Response(JSON.stringify({ reply: data.choices[0].message.content }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
