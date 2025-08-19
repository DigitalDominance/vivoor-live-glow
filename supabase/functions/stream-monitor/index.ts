import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const livepeerApiKey = Deno.env.get("LIVEPEER_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Monitor and clean up disconnected streams
    const { data: cleanedCount, error: cleanupError } = await supabase.rpc('monitor_livepeer_streams');
    
    if (cleanupError) {
      console.error('Error monitoring streams:', cleanupError);
      return new Response(
        JSON.stringify({ error: 'Failed to monitor streams', details: cleanupError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Optional: Validate streams against Livepeer API if needed
    if (livepeerApiKey && req.method === "POST") {
      try {
        const { data: liveStreams } = await supabase
          .from('streams')
          .select('id, playback_url')
          .eq('is_live', true);

        // Check each live stream against Livepeer API
        for (const stream of liveStreams || []) {
          if (stream.playback_url) {
            // Extract playback ID from URL
            const playbackIdMatch = stream.playback_url.match(/\/hls\/([^\/]+)\//);
            if (playbackIdMatch) {
              const playbackId = playbackIdMatch[1];
              
              try {
                const response = await fetch(`https://livepeer.studio/api/stream/${playbackId}`, {
                  headers: {
                    "Authorization": `Bearer ${livepeerApiKey}`,
                  },
                });
                
                if (response.ok) {
                  const streamData = await response.json();
                  
                  // If stream is not active on Livepeer, mark as ended
                  if (!streamData.isActive) {
                    console.log(`Stream ${stream.id} is not active on Livepeer, ending...`);
                    await supabase
                      .from('streams')
                      .update({ is_live: false, ended_at: new Date().toISOString() })
                      .eq('id', stream.id);
                  }
                }
              } catch (error) {
                console.error(`Error checking Livepeer stream ${playbackId}:`, error);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error validating streams against Livepeer:', error);
      }
    }

    // Clean up old ended streams (older than 7 days)
    const { data: deletedCount, error: deleteError } = await supabase.rpc('cleanup_old_streams', { days_old: 7 });
    
    if (deleteError) {
      console.error('Error cleaning up old streams:', deleteError);
    }

    console.log(`Stream monitoring completed. Cleaned: ${cleanedCount || 0}, Deleted old: ${deletedCount || 0}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        cleaned_streams: cleanedCount || 0,
        deleted_old_streams: deletedCount || 0,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Unexpected error in stream monitor:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});