import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const livepeerApiKey = Deno.env.get('LIVEPEER_API_KEY');

    if (!livepeerApiKey) {
      throw new Error('LIVEPEER_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { session_token, wallet_address, stream_id } = await req.json();

    if (!session_token || !wallet_address || !stream_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate session and get stream data
    const { data: sessionData } = await supabase
      .from('wallet_auth_sessions')
      .select('encrypted_user_id')
      .eq('session_token', session_token)
      .eq('wallet_address', wallet_address)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!sessionData) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get stream info
    const { data: streamData } = await supabase
      .from('streams')
      .select('livepeer_stream_id, user_id')
      .eq('id', stream_id)
      .single();

    if (!streamData) {
      return new Response(
        JSON.stringify({ error: 'Stream not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    if (streamData.user_id !== sessionData.encrypted_user_id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - not stream owner' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Stop Livepeer stream if it has a livepeer_stream_id
    if (streamData.livepeer_stream_id) {
      console.log('Stopping Livepeer stream:', streamData.livepeer_stream_id);
      
      try {
        const stopResponse = await fetch(
          `https://livepeer.studio/api/stream/${streamData.livepeer_stream_id}/stop`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${livepeerApiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!stopResponse.ok) {
          console.warn('Livepeer stop API returned error:', await stopResponse.text());
        } else {
          console.log('Successfully stopped Livepeer stream');
        }
      } catch (err) {
        console.warn('Error calling Livepeer stop API:', err);
      }
    }

    // Update database to mark stream as ended
    const { error: updateError } = await supabase.rpc('end_browser_stream_secure', {
      session_token_param: session_token,
      wallet_address_param: wallet_address,
      stream_id_param: stream_id
    });

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Stream stopped successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error stopping stream:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
