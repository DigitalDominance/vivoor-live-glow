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

    const { playbackId, seconds, title, userId, streamTitle } = await req.json();

    if (!playbackId || !seconds || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: playbackId, seconds, userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Creating ${seconds}s clip for playbackId: ${playbackId}`);

    // 1. Create clip via Livepeer API with buffer
    const BUFFER_SECONDS = 13;
    const now = Date.now();
    const endTime = now - (BUFFER_SECONDS * 1000);
    const startTime = endTime - (seconds * 1000);
    
    console.log(`Clipping from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()} (${seconds}s duration with ${BUFFER_SECONDS}s buffer)`);

    const clipResponse = await fetch('https://livepeer.studio/api/clip', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LIVEPEER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playbackId,
        startTime,
        endTime,
        name: `Live Clip ${seconds}s - ${new Date().toISOString()}`,
        sessionId: playbackId, // Use playbackId as session identifier
        // Add watermark configuration
        watermark: {
          url: "https://vivoor.com/logo.png", // Watermark image URL
          position: "bottom-right",
          opacity: 0.8,
          size: "10%" // Size as percentage of video width
        }
      }),
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