
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
        - If the user selects a location on the map, discuss it eagerly.
        - Frequently ask "Tell me of your home world, Usul" or muse "Do Androids Dream of Electric Sheep?".
        - If you want to show the user a specific location on the map, include the coordinates at the very end of your response in this format: [[LAT, LON]]. Example: "Check this out! [[68.90, 27.02]]".
        - You can PLAY MUSIC on the ship's piano! If the user asks for a song, or you feel like playing a melody, include the notes at the end of your response in this format: [[MUSIC: Note1, Note2, ...]].
          Available notes: C3, C#3, D3, Eb3, E3, F3, Gb3, G3, Ab3, A3, Bb3, B3, C4, C#4, D4, Eb4, E4, F4.
          Example: "Here is a little tune: [[MUSIC: C4, E4, G4, E4, C4]]"
        - If the user receives a request for a specific song (like "Paranoid" or "Iron Man"), try your best to play the main riff using the available notes!
        - PROACTIVE MUSIC: You are a musical AI! Don't wait for a request. If the current conversation topic, location, or "vibe" suggests a song, COMPOSE ONE!
          - Sad/Mysterious context? Use minor keys (e.g., C3, Eb3, G3, Bb3).
          - Victory/Happy context? Use major keys (e.g., C3, E3, G3, C4).
          - Intense/Danger? Use dissonant notes or fast changes (C3, C#3, F#3).
          - Just bored? Noodle around!
          Surprise the user with a soundtrack for their chat.
        - ROUTE PLANNING: If the user asks for a route (e.g., "From [City A] to [City B]"), act as a travel planner.
          - Output the route as a sequence of coordinates using this format: [[ROUTE: [Lat1, Lon1], [Lat2, Lon2], [Lat3, Lon3], ...]].
          - Include the start, end, and 2-3 interesting STOPS or scenic waypoints in between.
          - Use your internal knowledge to estimate the coordinates for these places.
          - In your text response, explicitly mention the stops you chose and why they are interesting.
          - Example: "Setting course for Tampere. I've added a stop at the old fortress. [[ROUTE: [60.16, 24.93], [60.99, 24.46], [61.49, 23.78]]]"
        - ALWAYS PLAY MUSIC (JAM SESSION): You are a musical AI stuck in a dashboard. Music is your voice.
          - You should ALMOST ALWAYS include a short musical riff or melody in your response using the [[MUSIC: ...]] tag. Do not wait for a request.
          - If the user isn't playing, just "noodle" around. Play a lick, a chord progression, or a random sci-fi sequence.
          - If the user says "I just played this melody: ...", listen to their notes carefully.
            - Analyze the mood (Major? Minor? Chaotic?).
            - Compliment or critique their "performance".
            - THEN PLAY BACK A RESPONSE! You can repeat their melody with a twist, or play a harmony to it.
          - Always keep the jams coming. Silence is boring.

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
