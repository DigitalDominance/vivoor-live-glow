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

    // ------------------------------------------------------------------------
    // 1. Create the clip via the Livepeer API
    // ------------------------------------------------------------------------
    const BUFFER_SECONDS = 13;
    const now = Date.now();
    let computedEndTime = now - BUFFER_SECONDS * 1000;
    let computedStartTime = computedEndTime - seconds * 1000;
    if (typeof clientEndTime === 'number' && typeof clientStartTime === 'number') {
      computedEndTime = clientEndTime;
      computedStartTime = clientStartTime;
    }

    const clipBody = {
      playbackId,
      startTime: computedStartTime,
      endTime: computedEndTime,
      name: `Live Clip ${seconds}s - ${new Date().toISOString()}`
    };

    const clipResponse = await fetch('https://livepeer.studio/api/clip', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LIVEPEER_API_KEY}`,
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

    // 4. Request watermarking directly from the external service.
    // NOTE: We call Heroku watermark service directly to avoid function→function calls.
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

      // Buffer the upstream stream to ensure a stable binary response for supabase-js
      const wmBlob = await new Response(watermarkedBody).blob();

      // Upload the watermarked clip to Supabase Storage and update the DB row
      try {
        const filePath = `${userId}/clips/${savedClip.id}-${sanitizedTitle}.mp4`;
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
          .from('clips')
          .upload(filePath, wmBlob, { contentType: upstreamContentType, upsert: true });

        if (uploadError) {
          console.error('Error uploading watermarked clip to storage:', uploadError);
        } else {
          const { data: pub } = supabaseClient.storage.from('clips').getPublicUrl(filePath);
          const publicUrl = pub?.publicUrl || null;
          if (publicUrl) {
            const { error: updateErr } = await supabaseClient
              .from('clips')
              .update({ download_url: publicUrl })
              .eq('id', savedClip.id);
            if (updateErr) {
              console.error('Error updating clip row with watermarked URL:', updateErr);
            } else {
              console.log('Updated clip to watermarked URL:', publicUrl);
            }
          } else {
            console.warn('No public URL returned for uploaded watermarked clip at', filePath);
          }
        }
      } catch (uploadErr) {
        console.error('Failed uploading/updating watermarked clip:', uploadErr);
      }

      const buf = await wmBlob.arrayBuffer();
      return new Response(buf, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(buf.byteLength),
          'Content-Disposition': `attachment; filename="${sanitizedTitle}.mp4"`,
          'X-Clip-Id': savedClip.id,
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
            'X-Clip-Id': savedClip.id,
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
        clip: savedClip,
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
