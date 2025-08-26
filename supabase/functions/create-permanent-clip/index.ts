import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LIVEPEER_API_KEY = Deno.env.get('LIVEPEER_API_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Accept optional startTime and endTime values from the client.  If they are not
    // provided we will calculate them below based off of the current server time.
    const {
      playbackId,
      seconds,
      title,
      userId,
      streamTitle,
      startTime: clientStartTime,
      endTime: clientEndTime,
    } = await req.json();

    if (!playbackId || !seconds || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: playbackId, seconds, userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Creating ${seconds}s clip for playbackId: ${playbackId}`);

    // ------------------------------------------------------------------------
    // 1. Create the clip via the Livepeer API
    //
    // The Livepeer clip API expects startTime and endTime values that reflect
    // timestamps from the viewer's playhead.  When the client does not pass
    // explicit values we fall back to a simple heuristic based off of the
    // current server clock.  We subtract a small buffer from the current
    // time to ensure we never request time ranges that are still being
    // processed by Livepeer.  If the client passed `startTime` and
    // `endTime` we use those values directly.
    const BUFFER_SECONDS = 13;
    const now = Date.now();
    let computedEndTime = now - BUFFER_SECONDS * 1000;
    let computedStartTime = computedEndTime - seconds * 1000;
    // Use client provided timestamps if present.  These should already be
    // expressed in milliseconds from the viewer's perspective.
    if (typeof clientEndTime === 'number' && typeof clientStartTime === 'number') {
      computedEndTime = clientEndTime;
      computedStartTime = clientStartTime;
    }

    console.log(
      `Clipping from ${new Date(computedStartTime).toISOString()} to ${new Date(computedEndTime).toISOString()} (${seconds}s duration with ${BUFFER_SECONDS}s buffer)`
    );

    const clipBody: Record<string, any> = {
      playbackId,
      startTime: computedStartTime,
      endTime: computedEndTime,
      name: `Live Clip ${seconds}s - ${new Date().toISOString()}`,
    };
    // Livepeer's API accepts an optional sessionId.  A unique session identifier
    // can help group clips together, but using the playbackId for every clip
    // request can cause conflicts if multiple clips are created concurrently.
    // Only include sessionId if supplied by the client; otherwise omit it to
    // allow Livepeer to generate its own session.
    const clientSessionId = req.headers.get('x-session-id');
    if (clientSessionId) {
      clipBody.sessionId = clientSessionId;
    }

    const clipResponse = await fetch('https://livepeer.studio/api/clip', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LIVEPEER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clipBody),
    });

    if (!clipResponse.ok) {
      const errorText = await clipResponse.text();
      console.error('Livepeer clip creation failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to create clip via Livepeer API' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { asset } = await clipResponse.json();
    console.log('Livepeer clip asset created:', asset.id);

    // 2. Wait for the asset to be ready
    let attempts = 0;
    const maxAttempts = 30;
    let assetReady = null;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));

      const statusResponse = await fetch(`https://livepeer.studio/api/asset/${asset.id}`, {
        headers: {
          'Authorization': `Bearer ${LIVEPEER_API_KEY}`,
        },
      });

      if (statusResponse.ok) {
        const assetData = await statusResponse.json();
        console.log(`Asset status check ${attempts + 1}: ${assetData.status?.phase}`);
        
        if (assetData.status?.phase === 'ready') {
          assetReady = assetData;
          break;
        }
        
        if (assetData.status?.phase === 'failed') {
          throw new Error('Asset processing failed');
        }
      }
      
      attempts++;
    }

    if (!assetReady) {
      throw new Error('Asset processing timeout');
    }

    console.log('Asset ready, using Livepeer download URL directly');

    // Use Livepeer's download URL directly without watermarking
    const clipTitle = title || `${streamTitle} - ${seconds}s Clip`;
    const publicUrl = assetReady.downloadUrl;

    // 8. Save clip to database with permanent URLs
    const { data: savedClip, error: saveError } = await supabaseClient
      .from('clips')
      .insert({
        title: clipTitle,
        user_id: userId,
        start_seconds: 0,
        end_seconds: seconds,
        download_url: publicUrl,
        thumbnail_url: publicUrl, // Could generate thumbnail later
        playback_id: playbackId,
        livepeer_asset_id: asset.id
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving clip to database:', saveError);
      throw new Error('Failed to save clip to database');
    }

    console.log('Clip successfully created and stored:', savedClip.id);

    return new Response(
      JSON.stringify({
        success: true,
        clip: savedClip,
        downloadUrl: publicUrl,
        playbackUrl: publicUrl
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-permanent-clip:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});