import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LIVEPEER_API_KEY = Deno.env.get('LIVEPEER_API_KEY');
const WATERMARK_API_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/watermark-proxy`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check for required environment variables
    if (!LIVEPEER_API_KEY) {
      console.error('LIVEPEER_API_KEY environment variable is not set');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: LIVEPEER_API_KEY not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    console.log(`Creating and watermarking ${seconds}s clip for playbackId: ${playbackId}`);

    // 1. Create the clip via Livepeer API
    const BUFFER_SECONDS = 13;
    const now = Date.now();
    let computedEndTime = now - BUFFER_SECONDS * 1000;
    let computedStartTime = computedEndTime - seconds * 1000;
    
    if (typeof clientEndTime === 'number' && typeof clientStartTime === 'number') {
      computedEndTime = clientEndTime;
      computedStartTime = clientStartTime;
    }

    console.log(
      `Clipping from ${new Date(computedStartTime).toISOString()} to ${new Date(computedEndTime).toISOString()}`
    );

    const clipBody: Record<string, any> = {
      playbackId,
      startTime: computedStartTime,
      endTime: computedEndTime,
      name: `Live Clip ${seconds}s - ${new Date().toISOString()}`,
    };

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

    console.log('Asset ready, preparing database record and watermark request');

    // 3. Save clip to database once. We store the original Livepeer download URL since
    // the watermark service may fail; in that case we still want the clip recorded.
    const clipTitle = title || `${streamTitle} - ${seconds}s Clip`;
    const sanitizedTitle = clipTitle.replace(/[^A-Za-z0-9._-]/g, '_') || 'clip';

    const { data: savedClip, error: saveError } = await supabaseClient
      .from('clips')
      .insert({
        title: clipTitle,
        user_id: userId,
        start_seconds: 0,
        end_seconds: seconds,
        download_url: assetReady.downloadUrl, // Store original URL in DB
        thumbnail_url: assetReady.downloadUrl,
        playback_id: playbackId,
        livepeer_asset_id: asset.id
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving clip to database:', saveError);
      throw new Error('Failed to save clip to database');
    }

    console.log('Database clip saved:', savedClip.id);

    // 4. Request watermarking via proxy. We include Supabase anon key for authorization
    const watermarkResponse = await fetch(WATERMARK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        videoUrl: assetReady.downloadUrl,
        position: 'br',
        margin: 24,
        wmWidth: 180,
        filename: `${sanitizedTitle}.mp4`
      })
    });

    if (!watermarkResponse.ok) {
      // The watermark service failed or returned an error. We'll log details and
      // return the original clip as the response body. This ensures that the
      // client still receives a binary response (Blob) rather than JSON so that
      // front-end code does not throw "Unexpected response from watermark service".
      const errorText = await watermarkResponse.text().catch(() => '');
      console.error('Watermark service failed:', {
        status: watermarkResponse.status,
        statusText: watermarkResponse.statusText,
        headers: Object.fromEntries(watermarkResponse.headers.entries()),
        response: errorText
      });

      // Attempt to fetch the original asset as a fallback
      try {
        const originalRes = await fetch(assetReady.downloadUrl);
        if (originalRes.ok && originalRes.body) {
          const ct = originalRes.headers.get('content-type') || 'video/mp4';
          // return original clip binary with headers
          return new Response(originalRes.body, {
            headers: {
              ...corsHeaders,
              'Content-Type': ct,
              'Content-Disposition': `attachment; filename="${sanitizedTitle}.mp4"`,
              'X-Clip-Id': savedClip.id,
              'X-Watermarked': 'false'
            }
          });
        }
      } catch (fetchErr) {
        console.error('Failed to fetch original clip as fallback:', fetchErr);
      }

      // If we cannot fetch the original clip, return a JSON payload indicating
      // failure. Although this is less ideal (front-end will throw), it still
      // communicates the error.
      return new Response(
        JSON.stringify({
          success: false,
          clip: savedClip,
          downloadUrl: assetReady.downloadUrl,
          watermarked: false,
          error: 'Watermarking failed and fallback download failed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Watermarking succeeded. Return the binary video and mark watermarked
    const watermarkedVideo = await watermarkResponse.blob();
    return new Response(watermarkedVideo, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${sanitizedTitle}.mp4"`,
        'X-Clip-Id': savedClip.id,
        'X-Watermarked': 'true'
      }
    });

  } catch (error) {
    console.error('Error in watermark-clip:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
