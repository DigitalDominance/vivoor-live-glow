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

    console.log('Asset ready, sending to watermark service');

    // 3. Send to watermark service
    const clipTitle = title || `${streamTitle} - ${seconds}s Clip`;
    const sanitizedTitle = clipTitle.replace(/[^A-Za-z0-9._-]/g, '_') || 'clip';
    
    const formData = new FormData();
    formData.append('videoUrl', assetReady.downloadUrl);
    formData.append('position', 'br');
    formData.append('margin', '24');
    formData.append('wmWidth', '180');
    formData.append('filename', `${sanitizedTitle}.mp4`);

    console.log('Sending request to watermark service:', {
      url: WATERMARK_API_URL,
      videoUrl: assetReady.downloadUrl,
      position: 'br',
      margin: '24',
      wmWidth: '180',
      filename: `${sanitizedTitle}.mp4`
    });

    const watermarkResponse = await fetch(WATERMARK_API_URL, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'video/mp4',
      }
    });

    if (!watermarkResponse.ok) {
      const errorText = await watermarkResponse.text();
      console.error('Watermark service failed:', {
        status: watermarkResponse.status,
        statusText: watermarkResponse.statusText,
        headers: Object.fromEntries(watermarkResponse.headers.entries()),
        response: errorText
      });
      // Fall back to original clip if watermarking fails
      const { data: savedClip, error: saveError } = await supabaseClient
        .from('clips')
        .insert({
          title: clipTitle,
          user_id: userId,
          start_seconds: 0,
          end_seconds: seconds,
          download_url: assetReady.downloadUrl,
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

      return new Response(
        JSON.stringify({
          success: true,
          clip: savedClip,
          downloadUrl: assetReady.downloadUrl,
          watermarked: false,
          error: 'Watermarking failed, returning original clip'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Save clip to database
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

    console.log('Clip successfully created and watermarked:', savedClip.id);

    // 5. Return the watermarked video as binary
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