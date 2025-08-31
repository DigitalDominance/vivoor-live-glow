import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  // Allow all origins by default; if you need to restrict origins,
  // adjust this header accordingly. We include the necessary CORS
  // response headers so browsers can make requests from
  // https://vivoor.xyz or local development domains.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // Expose custom headers so the client can read clip metadata
  'Access-Control-Expose-Headers': 'Content-Disposition, X-Clip-Id, X-Watermarked',
};

const LIVEPEER_API_KEY = Deno.env.get('LIVEPEER_API_KEY');
/**
 * Compute the URL of the watermark proxy at runtime.  When running inside the
 * Supabase edge environment, environment variables like SUPABASE_URL are not
 * guaranteed to be set.  Deriving the base URL from the incoming request
 * ensures that we always call the correct origin (e.g. https://<project>.supabase.co).
 */
function getWatermarkProxyUrl(req: Request) {
  try {
    // Use the request URL to determine the origin of the current function call.
    const url = new URL(req.url);
    return `${url.origin}/functions/v1/watermark-proxy`;
  } catch {
    // Fallback to the SUPABASE_URL env var if parsing fails; if that isn't set
    // then the caller will hit an invalid URL which will surface an error.
    const envUrl = Deno.env.get('SUPABASE_URL') ?? '';
    return `${envUrl}/functions/v1/watermark-proxy`;
  }
}

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

    /* deferring DB insert until after watermark upload */
const savedClip = null as any;

    if (saveError) {
      console.error('Error saving clip to database:', saveError);
      throw new Error('Failed to save clip to database');
    }

    console.log('Database clip saved:', savedClip.id);

    // 4. Request watermarking directly from the external service. We avoid
    // calling another edge function here because Supabase functions cannot
    // reliably invoke each other (and may return 405 Method Not Allowed).
    // Instead, we call the Heroku watermark service directly with a
    // multipart/form-data payload.
    const upstreamUrl = Deno.env.get('WATERMARK_URL') || 'https://vivoor-e15c882142f5.herokuapp.com/watermark';

    const form = new FormData();
    form.set('videoUrl', assetReady.downloadUrl);
    form.set('position', 'br');
    form.set('margin', String(24));
    form.set('wmWidth', String(180));
    form.set('filename', `${sanitizedTitle}.mp4`);

    let watermarkSuccess = false;
    let watermarkedBody: ReadableStream<Uint8Array> | null = null;
    let upstreamContentType = 'video/mp4';
    try {
      const upstreamRes = await fetch(upstreamUrl, {
        method: 'POST',
        body: form,
      });
      if (upstreamRes.ok && upstreamRes.body) {
        watermarkSuccess = true;
        watermarkedBody = upstreamRes.body;
        upstreamContentType = upstreamRes.headers.get('content-type') || 'video/mp4';
      } else {
        const text = await upstreamRes.text().catch(() => '');
        console.error('Watermark service failed:', {
          status: upstreamRes.status,
          statusText: upstreamRes.statusText,
          headers: Object.fromEntries(upstreamRes.headers.entries()),
          response: text,
        });
      }
    } catch (wmErr) {
      console.error('Watermark service error:', wmErr);
    }

    // 5. If watermarking succeeded, stream back the binary video and mark as watermarked.
    
if (watermarkSuccess && watermarkedBody) {
      // Read upstream stream fully first so we can both upload and return the same bytes
      const wmBuf = await new Response(watermarkedBody).arrayBuffer();

      // Upload watermarked bytes to Supabase Storage and SAVE to DB (only after success)
      const storage = supabaseClient.storage.from('clips');
      const filePath = `users/${userId}/clips/${asset.id}-${Date.now()}.mp4`;
      const upRes = await storage.upload(filePath, wmBuf, { contentType: 'video/mp4', upsert: true });
      if (upRes?.error) {
        console.error('Storage upload failed:', upRes.error);
        return new Response(JSON.stringify({ error: 'Failed to store watermarked clip' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const pub = storage.getPublicUrl(filePath);
      const watermarkedUrl = pub?.data?.publicUrl || '';
      if (!watermarkedUrl) {
        return new Response(JSON.stringify({ error: 'Could not resolve public URL for stored clip' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const clipTitle = title || `${streamTitle} - ${seconds}s Clip`;
      const { data: savedClipRec, error: saveError } = await supabaseClient
        .from('clips')
        .insert({
          title: clipTitle,
          user_id: userId,
          start_seconds: 0,
          end_seconds: seconds,
          download_url: watermarkedUrl,
          thumbnail_url: watermarkedUrl,
          playback_id: playbackId,
          livepeer_asset_id: asset.id
        })
        .select()
        .single();
      if (saveError) {
        console.error('Error saving watermarked clip to database:', saveError);
        return new Response(JSON.stringify({ error: 'Failed to save watermarked clip to database' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Return the same bytes to the client as an MP4 file
      return new Response(wmBuf, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'video/mp4',
          'Content-Length': String(wmBuf.byteLength),
          'Content-Disposition': `attachment; filename="${sanitizedTitle}.mp4"`,
          'X-Clip-Id': savedClipRec.id,
          'X-Watermarked': 'true',
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache',
        },
      });
    }
// 6. Watermarking failed. Attempt to fetch the original asset as fallback.
    try {
      const originalRes = await fetch(assetReady.downloadUrl);
      if (originalRes.ok && originalRes.body) {
        const ct = originalRes.headers.get('content-type') || 'video/mp4';
        return new Response(originalRes.body, {
          headers: {
            ...corsHeaders,
            'Content-Type': ct,
            'Content-Disposition': `attachment; filename="${sanitizedTitle}.mp4"`,
            'X-Clip-Id': savedClipRec.id,
            'X-Watermarked': 'false',
          },
        });
      }
    } catch (fetchErr) {
      console.error('Failed to fetch original clip as fallback:', fetchErr);
    }
    // If we cannot fetch the original clip, return a JSON error response.
    return new Response(
      JSON.stringify({
        success: false,
        clip: null,
        downloadUrl: assetReady.downloadUrl,
        watermarked: false,
        error: 'Watermarking failed and fallback download failed',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error) {
    console.error('Error in watermark-clip:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
