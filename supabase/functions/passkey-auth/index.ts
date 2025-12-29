
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0';
import { RequestBody, ApiResponse, error, getOrigin, getClientIP } from './utils.ts';
import {
  handleRegisterStart,
  handleRegisterFinish,
  handleLoginStart,
  handleLoginFinish,
  handleListPasskeys,
  handleRemovePasskey,
  handleUpdatePasskey
} from './handlers.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
      },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const origin = getOrigin(req);
  const clientIP = getClientIP(req);

  try {
    const { endpoint, data }: RequestBody = await req.json();
    const { challengeId } = data as Record<string, unknown>;

    let result: ApiResponse;

    switch (endpoint) {
      case '/register/start':
        result = await handleRegisterStart(supabaseAdmin, data, endpoint, clientIP, origin);
        break;
      case '/register/finish':
        result = await handleRegisterFinish(supabaseAdmin, data, challengeId as string, clientIP, origin);
        break;
      case '/login/start':
        result = await handleLoginStart(supabaseAdmin, data, endpoint, clientIP);
        break;
      case '/login/finish':
        result = await handleLoginFinish(supabaseAdmin, data, challengeId as string, clientIP, origin);
        break;
      case '/passkeys/list':
        result = await handleListPasskeys(supabaseAdmin, supabaseUrl, req);
        break;
      case '/passkeys/remove':
        result = await handleRemovePasskey(supabaseAdmin, supabaseUrl, req, data, clientIP);
        break;
      case '/passkeys/update':
        result = await handleUpdatePasskey(supabaseAdmin, supabaseUrl, req, data, clientIP);
        break;
      default:
        result = error('NOT_FOUND', `Unknown endpoint: ${endpoint}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    return new Response(JSON.stringify(error('UNKNOWN_ERROR', 'Internal server error')), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
});
