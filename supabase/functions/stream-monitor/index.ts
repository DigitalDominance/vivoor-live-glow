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

    let cleanedCount = 0;

    // Always check Livepeer API for accurate stream status
    if (livepeerApiKey) {
      try {
        // Get all streams with Livepeer stream IDs (RTMP and browser)
        const { data: liveStreams } = await supabase
          .from('streams')
          .select('id, livepeer_stream_id, playback_url, stream_type, last_heartbeat')
          .eq('is_live', true)
          .not('livepeer_stream_id', 'is', null); // Only check streams with Livepeer IDs

        console.log(`Checking ${liveStreams?.length || 0} live streams against Livepeer API`);

        // Check each live stream via Livepeer API
        for (const stream of liveStreams || []) {
          
          // Handle Livepeer streams
          if (stream.livepeer_stream_id) {
            // Use the actual Livepeer stream ID for accurate status checking
            try {
              const response = await fetch(`https://livepeer.studio/api/stream/${stream.livepeer_stream_id}`, {
                headers: {
                  "Authorization": `Bearer ${livepeerApiKey}`,
                },
              });
              
              if (response.ok) {
                const streamData = await response.json();
                
                // If stream is not active on Livepeer, mark as ended
                if (!streamData.isActive) {
                  console.log(`Stream ${stream.id} (${stream.livepeer_stream_id}) is not active on Livepeer, ending...`);
                  await supabase
                    .from('streams')
                    .update({ is_live: false, ended_at: new Date().toISOString() })
                    .eq('id', stream.id);
                  cleanedCount++;
                } else {
                  console.log(`Stream ${stream.id} (${stream.livepeer_stream_id}) is active on Livepeer`);
                }
              } else {
                console.error(`Error fetching Livepeer stream ${stream.livepeer_stream_id}: ${response.status}`);
                // If stream doesn't exist on Livepeer, mark as ended
                if (response.status === 404) {
                  console.log(`Stream ${stream.id} (${stream.livepeer_stream_id}) not found on Livepeer, ending...`);
                  await supabase
                    .from('streams')
                    .update({ is_live: false, ended_at: new Date().toISOString() })
                    .eq('id', stream.id);
                  cleanedCount++;
                }
              }
            } catch (error) {
              console.error(`Error checking Livepeer stream ${stream.livepeer_stream_id}:`, error);
            }
          } else if (stream.playback_url) {
            // Fallback: Extract playback ID from URL for older streams
            const playbackIdMatch = stream.playback_url.match(/\/hls\/([^\/]+)\//);
            if (playbackIdMatch) {
              const playbackId = playbackIdMatch[1];
              console.log(`Using fallback playback ID ${playbackId} for stream ${stream.id}`);
              
              try {
                const response = await fetch(`https://livepeer.studio/api/stream/${playbackId}`, {
                  headers: {
                    "Authorization": `Bearer ${livepeerApiKey}`,
                  },
                });
                
                if (response.ok) {
                  const streamData = await response.json();
                  if (!streamData.isActive) {
                    console.log(`Stream ${stream.id} (fallback ${playbackId}) is not active, ending...`);
                    await supabase
                      .from('streams')
                      .update({ is_live: false, ended_at: new Date().toISOString() })
                      .eq('id', stream.id);
                    cleanedCount++;
                  }
                } else if (response.status === 404) {
                  console.log(`Stream ${stream.id} (fallback ${playbackId}) not found, ending...`);
                  await supabase
                    .from('streams')
                    .update({ is_live: false, ended_at: new Date().toISOString() })
                    .eq('id', stream.id);
                  cleanedCount++;
                }
              } catch (error) {
                console.error(`Error checking fallback stream ${playbackId}:`, error);
              }
            }
          } else {
            // Streams without livepeer_stream_id or playback_url should not be live
            console.log(`Stream ${stream.id} has no Livepeer identifiers, ending...`);
            await supabase
              .from('streams')
              .update({ is_live: false, ended_at: new Date().toISOString() })
              .eq('id', stream.id);
            cleanedCount++;
          }
        }
      } catch (error) {
        console.error('Error validating streams against Livepeer:', error);
      }
    } else {
      console.warn('No Livepeer API key configured, falling back to heartbeat-based cleanup');
      // Fallback to heartbeat-based cleanup if no API key
      const { data: heartbeatCleaned, error: cleanupError } = await supabase.rpc('monitor_livepeer_streams');
      
      if (cleanupError) {
        console.error('Error monitoring streams:', cleanupError);
        return new Response(
          JSON.stringify({ error: 'Failed to monitor streams', details: cleanupError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      cleanedCount = heartbeatCleaned || 0;
    }

    // Clean up old ended streams more aggressively (1 day instead of 7)
    const { data: deletedCount, error: deleteError } = await supabase.rpc('cleanup_old_streams', { days_old: 1 });
    
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