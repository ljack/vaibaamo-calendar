
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
        const { prompt, image_url: _image_url } = await req.json();
        const apiKey = Deno.env.get("OPENAI_API_KEY");
        if (!apiKey) throw new Error("Missing OpenAI API Key");

        console.log("Generating image with prompt:", prompt);

        // We use DALL-E 3 for high quality "creative edit" (generation)
        const response = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "dall-e-3",
                prompt: prompt,
                n: 1,
                size: "1024x1024",
                response_format: "b64_json",
                quality: "standard"
            }),
        });

        const data = await response.json();

        if (data.error) {
            console.error("OpenAI Error:", data.error);
            throw new Error(data.error.message);
        }

        const b64 = data.data[0].b64_json;
        // Construct a data URL or just return b64 to be uploaded by client
        // Returning b64 is easier for client to handle (display or upload)

        return new Response(JSON.stringify({
            image_b64: b64,
            message: "Image generated successfully"
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
