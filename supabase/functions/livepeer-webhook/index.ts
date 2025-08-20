import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LivepeerWebhookEvent {
  id: string;
  userId: string;
  createdAt: number;
  event: 'stream.started' | 'stream.idle' | 'recording.ready' | 'recording.started' | 'recording.waiting';
  stream: {
    id: string;
    name: string;
    isActive: boolean;
    lastSeen: number;
    createdAt: number;
    updatedAt: number;
    playbackId: string;
    recordObjectStoreId?: string;
  };
  payload?: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload: LivepeerWebhookEvent = await req.json();
    
    console.log('Received Livepeer webhook:', {
      event: payload.event,
      streamId: payload.stream.id,
      isActive: payload.stream.isActive,
      timestamp: new Date().toISOString()
    });

    // Find the stream in our database by livepeer_stream_id
    const { data: stream, error: findError } = await supabase
      .from('streams')
      .select('id, user_id, title')
      .eq('livepeer_stream_id', payload.stream.id)
      .single();

    if (findError || !stream) {
      console.log('Stream not found in database:', payload.stream.id);
      return new Response(
        JSON.stringify({ error: 'Stream not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Handle different event types
    switch (payload.event) {
      case 'stream.started':
        console.log(`Stream started: ${stream.title} (${stream.id})`);
        
        // Mark stream as live and update heartbeat
        const { error: startError } = await supabase
          .from('streams')
          .update({
            is_live: true,
            last_heartbeat: new Date().toISOString(),
            ended_at: null // Clear any previous end time
          })
          .eq('id', stream.id);

        if (startError) {
          console.error('Error updating stream to live:', startError);
          throw startError;
        }
        break;

      case 'stream.idle':
        console.log(`Stream went idle: ${stream.title} (${stream.id})`);
        
        // Mark stream as not live and set end time
        const { error: idleError } = await supabase
          .from('streams')
          .update({
            is_live: false,
            ended_at: new Date().toISOString()
          })
          .eq('id', stream.id);

        if (idleError) {
          console.error('Error updating stream to idle:', idleError);
          throw idleError;
        }
        break;

      case 'recording.ready':
        console.log(`Recording ready for stream: ${stream.title} (${stream.id})`);
        
        // Update the stream with playback URL if available
        if (payload.stream.playbackId) {
          const playbackUrl = `https://livepeercdn.studio/hls/${payload.stream.playbackId}/index.m3u8`;
          
          const { error: recordingError } = await supabase
            .from('streams')
            .update({
              playback_url: playbackUrl
            })
            .eq('id', stream.id);

          if (recordingError) {
            console.error('Error updating stream playback URL:', recordingError);
          } else {
            console.log(`Updated playback URL for stream ${stream.id}: ${playbackUrl}`);
          }
        }
        break;

      default:
        console.log(`Unhandled event type: ${payload.event}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${payload.event} for stream ${stream.id}`,
        streamId: stream.id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Webhook processing error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Webhook processing failed',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});