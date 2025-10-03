import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const livepeerApiKey = Deno.env.get('LIVEPEER_API_KEY');
    if (!livepeerApiKey) {
      throw new Error('LIVEPEER_API_KEY not configured');
    }

    // Check if this is a single stream check (for browser streams)
    const body = await req.json().catch(() => ({}));
    const singleStreamId = body.streamId;

    if (singleStreamId) {
      // Single stream check for browser streams
      console.log(`Checking single Livepeer stream: ${singleStreamId}`);
      
      const response = await fetch(`https://livepeer.studio/api/stream/${singleStreamId}`, {
        headers: {
          'Authorization': `Bearer ${livepeerApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch stream from Livepeer: ${response.status}`);
      }

      const livepeerStream = await response.json();
      console.log(`Livepeer stream data:`, JSON.stringify(livepeerStream, null, 2));
      
      // For browser/WebRTC streams, also check for active sessions
      let hasActiveSessions = false;
      if (livepeerStream.parentId) {
        // This is a session, check if it's active
        const now = Date.now();
        const lastSeenTime = livepeerStream.lastSeen || 0;
        const timeSinceLastSeen = now - lastSeenTime;
        const maxIdleTime = 60 * 1000; // 60 seconds for sessions
        hasActiveSessions = timeSinceLastSeen < maxIdleTime;
        console.log(`Session check: lastSeen=${lastSeenTime}, timeSince=${timeSinceLastSeen}ms, hasActiveSessions=${hasActiveSessions}`);
      } else {
        // This is a parent stream, check for active sessions
        try {
          const sessionsResponse = await fetch(`https://livepeer.studio/api/stream/${singleStreamId}/sessions`, {
            headers: {
              'Authorization': `Bearer ${livepeerApiKey}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (sessionsResponse.ok) {
            const sessions = await sessionsResponse.json();
            console.log(`Found ${sessions.length} sessions for stream ${singleStreamId}`);
            
            // Check if any session is active (has recent lastSeen)
            const now = Date.now();
            const maxIdleTime = 60 * 1000; // 60 seconds
            hasActiveSessions = sessions.some((session: any) => {
              const timeSinceLastSeen = now - (session.lastSeen || 0);
              return timeSinceLastSeen < maxIdleTime;
            });
            console.log(`Has active sessions: ${hasActiveSessions}`);
          }
        } catch (error) {
          console.error(`Error checking sessions:`, error);
        }
      }
      
      const now = Date.now();
      const lastSeenTime = livepeerStream.lastSeen || 0;
      const timeSinceLastSeen = now - lastSeenTime;
      const maxIdleTime = 60 * 1000; // 60 seconds for browser streams
      
      // Browser stream is live if:
      // 1. It has active sessions OR
      // 2. isActive is true and lastSeen is recent OR
      // 3. lastSeen is very recent (within 60 seconds)
      const isActuallyLive = hasActiveSessions || 
                            (livepeerStream.isActive === true && timeSinceLastSeen < maxIdleTime) ||
                            timeSinceLastSeen < maxIdleTime;
      
      console.log(`Final status: isActive=${livepeerStream.isActive}, timeSince=${timeSinceLastSeen}ms, hasActiveSessions=${hasActiveSessions}, isActuallyLive=${isActuallyLive}`);
      
      return new Response(
        JSON.stringify({ isActive: isActuallyLive, lastSeen: livepeerStream.lastSeen }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Bulk check for all RTMP streams (original behavior)
    const { data: streams, error: streamsError } = await supabaseClient
      .from('streams')
      .select('id, livepeer_stream_id, user_id, title, is_live')
      .neq('livepeer_stream_id', null)
      .neq('stream_type', 'browser'); // Exclude browser streams from bulk check

    console.log(`Found ${streams?.length || 0} RTMP streams with Livepeer IDs to check`);

    if (streamsError) {
      throw new Error(`Failed to fetch streams: ${streamsError.message}`);
    }

    if (!streams || streams.length === 0) {
      return new Response(
        JSON.stringify({ updated: 0, message: 'No RTMP streams with Livepeer IDs to check' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let updatedCount = 0;

    // Check each stream's status with Livepeer API
    for (const stream of streams) {
      if (!stream.livepeer_stream_id) {
        console.log(`Stream ${stream.id} has no Livepeer stream ID, skipping`);
        continue;
      }

      try {
        console.log(`Checking Livepeer stream ${stream.livepeer_stream_id} for database stream ${stream.id}`);
        
        // Check stream status with Livepeer API
        const response = await fetch(`https://livepeer.studio/api/stream/${stream.livepeer_stream_id}`, {
          headers: {
            'Authorization': `Bearer ${livepeerApiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error(`Failed to fetch stream ${stream.livepeer_stream_id} from Livepeer: ${response.status} ${response.statusText}`);
          continue;
        }

        const livepeerStream = await response.json();
        
        // Check if stream is actually live based on Livepeer status
        // According to Livepeer docs: isActive indicates if stream is currently receiving data
        // lastSeen should be recent for truly active streams
        const now = Date.now();
        const lastSeenTime = livepeerStream.lastSeen || 0;
        const timeSinceLastSeen = now - lastSeenTime;
        const maxIdleTime = 90 * 1000; // 90 seconds in milliseconds - more lenient for live streams
        
        // Stream is live if it's active and has been seen recently
        const isActuallyLive = livepeerStream.isActive === true && timeSinceLastSeen < maxIdleTime;
        
        console.log(`Stream ${stream.livepeer_stream_id}: isActive = ${livepeerStream.isActive}, lastSeen = ${livepeerStream.lastSeen}, timeSinceLastSeen = ${timeSinceLastSeen}ms, isActuallyLive = ${isActuallyLive}, DB is_live = ${stream.is_live}`);

        // Update our database based on actual Livepeer status
        if (isActuallyLive && !stream.is_live) {
          // Stream is live but marked as not live in DB - mark it as live
          console.log(`Stream ${stream.id} is actually live, updating database`);
          const { error: updateError } = await supabaseClient
            .from('streams')
            .update({
              is_live: true,
              last_heartbeat: new Date().toISOString()
            })
            .eq('id', stream.id);

          if (updateError) {
            console.error(`Failed to update stream ${stream.id}:`, updateError);
          } else {
            updatedCount++;
          }
        } else if (!isActuallyLive && stream.is_live) {
          // Stream is not live but marked as live in DB - mark it as ended
          console.log(`Stream ${stream.id} (${stream.title}) is not actually live, marking as ended`);
          
          const { error: updateError } = await supabaseClient
            .from('streams')
            .update({
              is_live: false,
              ended_at: new Date().toISOString(),
              last_heartbeat: new Date().toISOString()
            })
            .eq('id', stream.id);

          if (updateError) {
            console.error(`Failed to update stream ${stream.id}:`, updateError);
          } else {
            updatedCount++;
          }
        } else if (isActuallyLive) {
          // Stream is live and correctly marked - just update heartbeat
          await supabaseClient
            .from('streams')
            .update({ last_heartbeat: new Date().toISOString() })
            .eq('id', stream.id);
        }
      } catch (error) {
        console.error(`Error checking stream ${stream.livepeer_stream_id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        updated: updatedCount, 
        checked: streams.length,
        message: `Checked ${streams.length} streams, updated ${updatedCount}` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-livepeer-status function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});