
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // 1. Authenticate the user
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 2. Get and validate the prompt
        const { prompt } = await req.json();
        
        if (!prompt || typeof prompt !== 'string') {
            return new Response(JSON.stringify({ error: 'Invalid or missing prompt' }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Validate prompt length and sanitize
        const sanitizedPrompt = prompt.trim();
        if (sanitizedPrompt.length === 0) {
            return new Response(JSON.stringify({ error: 'Prompt cannot be empty' }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (sanitizedPrompt.length > 1000) {
            return new Response(JSON.stringify({ error: 'Prompt too long (max 1000 characters)' }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const apiKey = Deno.env.get("OPENAI_API_KEY");
        if (!apiKey) throw new Error("Missing OpenAI API Key");

        console.log(`[${new Date().toISOString()}] User ${user.id} generating image with prompt length: ${sanitizedPrompt.length}`);

        // We use DALL-E 3 for high quality "creative edit" (generation)
        const response = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "dall-e-3",
                prompt: sanitizedPrompt,
                n: 1,
                size: "1024x1024",
                response_format: "b64_json",
                quality: "standard"
            }),
        });

        const data = await response.json();

        if (data.error) {
            console.error(`[${new Date().toISOString()}] OpenAI Error:`, data.error);
            throw new Error(data.error.message);
        }

        const b64 = data.data[0].b64_json;
        console.log(`[${new Date().toISOString()}] Image generated successfully for user ${user.id}`);

        return new Response(JSON.stringify({
            image_b64: b64,
            message: "Image generated successfully"
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error:`, error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
