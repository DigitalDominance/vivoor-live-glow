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

function absolutizeUrl(maybeUrl: string | null | undefined, base: string): string | null {
  if (!maybeUrl) return null;
  try {
    // Handles absolute and relative cases
    return new URL(String(maybeUrl), base).toString();
  } catch {
    return null;
  }
}
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
    
    // 4. Enqueue watermarking as a background job on the Heroku backend
    // Instead of waiting for the full watermarked file (which can exceed 30s),
    // we submit the job and return identifiers so the client can poll.
    
    // 4. Enqueue watermarking as a background job on the Heroku backend
    
    // 4. Enqueue watermark job and WAIT until it's finished, then return the MP4
    const upstreamUrl = Deno.env.get('WATERMARK_URL') || 'https://vivoor-e15c882142f5.herokuapp.com/watermark';

    const form = new FormData();
    form.set('videoUrl', assetReady.downloadUrl);
    form.set('position', 'br');
    form.set('margin', String(24));
    form.set('wmWidth', String(180));
    form.set('filename', `${sanitizedTitle}.mp4`);

    const enqueueRes = await fetch(upstreamUrl, { method: 'POST', body: form });
    if (!enqueueRes.ok) {
      const text = await enqueueRes.text().catch(() => '');
      console.error('Failed to enqueue watermark job:', enqueueRes.status, text);
      return new Response(JSON.stringify({ error: 'Failed to enqueue watermark job' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const enqueueJson = await enqueueRes.json().catch(() => ({} as any));
const jobId = (enqueueJson as any).jobId ?? (enqueueJson as any).id ?? null;
const statusUrlRel = (enqueueJson as any).statusUrl ?? null;
const resultUrlRel = (enqueueJson as any).resultUrl ?? null;

    // Build absolute URLs from potential relative paths
    const base = new URL(upstreamUrl);
    const statusUrl = statusUrlRel ? (statusUrlRel.startsWith('http') ? statusUrlRel : `${base.origin}${statusUrlRel}`) : null;
    const resultUrl = resultUrlRel ? (resultUrlRel.startsWith('http') ? resultUrlRel : `${base.origin}${resultUrlRel}`) : null;

    if (!jobId || !statusUrl) {
      console.error('Watermark enqueue did not return jobId/statusUrl');
      return new Response(JSON.stringify({ error: 'Watermark enqueue missing job info' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Poll status until completed or timeout
    const MAX_WAIT_MS = Number(Deno.env.get('WATERMARK_MAX_WAIT_MS') || 115000);
    const POLL_MS = 2000;
    const deadline = Date.now() + MAX_WAIT_MS;
    let completed = false;
    let failed = false;
    let lastStatus: any = null;

    while (Date.now() < deadline) {
      const sRes = await fetch(statusUrl);
      if (sRes.ok) {
        lastStatus = await sRes.json().catch(() => null);
        const st = lastStatus?.status || lastStatus?.state || null;
        if (st === 'completed') { completed = true; break; }
        if (st === 'failed') { failed = true; break; }
      } else {
        console.warn('status poll non-200:', sRes.status);
      }
      await new Promise(r => setTimeout(r, POLL_MS));
    }

    if (!completed || failed) {
      console.error('Watermark job did not complete in time or failed:', { completed, failed, lastStatus });
      return new Response(JSON.stringify({ error: 'Watermark still processing', jobId, statusUrl }), { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch final result MP4
    const finalUrlRel = (lastStatus && (lastStatus as any).resultUrl) || resultUrl;
const finalUrl = absolutizeUrl(finalUrlRel, upstreamUrl);
if (!finalUrl) {
      console.error('No resultUrl provided on completion:', lastStatus);
      return new Response(JSON.stringify({ error: 'No resultUrl on completed job' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const rRes = await fetch(finalUrl);
    if (!rRes.ok || !rRes.body) {
      const txt = await rRes.text().catch(() => '');
      console.error('Failed to download watermarked MP4:', rRes.status, txt);
      return new Response(JSON.stringify({ error: 'Failed to download watermarked MP4' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Upload the watermarked clip to Supabase Storage and update DB row
    const wmBlob = await (new Response(rRes.body)).blob();
    
    // Check blob size and compress if too large (>45MB for safety margin under 50MB limit)
    const MAX_SIZE_BYTES = 45 * 1024 * 1024; // 45MB
    let finalBlob = wmBlob;
    
    console.log(`Original watermarked clip size: ${(wmBlob.size / 1024 / 1024).toFixed(2)}MB`);
    
    if (wmBlob.size > MAX_SIZE_BYTES) {
      console.log('Clip exceeds size limit, compressing via watermark proxy...');
      
      try {
        // Use the watermark proxy to compress the video
        const watermarkProxyUrl = getWatermarkProxyUrl(req);
        const compressForm = new FormData();
        compressForm.set('videoUrl', finalUrl);
        compressForm.set('position', 'br');
        compressForm.set('margin', String(24));
        compressForm.set('wmWidth', String(120)); // Smaller watermark
        compressForm.set('filename', `${sanitizedTitle}_compressed.mp4`);
        compressForm.set('quality', '23'); // Lower quality for smaller size
        compressForm.set('scale', '720:-1'); // Scale down to 720p height
        
        const compressRes = await fetch(watermarkProxyUrl, {
          method: 'POST',
          body: compressForm,
          headers: {
            'Authorization': req.headers.get('Authorization') || '',
          }
        });
        
        if (compressRes.ok && compressRes.body) {
          finalBlob = await compressRes.blob();
          console.log(`Compressed clip size: ${(finalBlob.size / 1024 / 1024).toFixed(2)}MB`);
        } else {
          console.warn('Compression failed, using original size');
        }
      } catch (compressErr) {
        console.error('Compression error, using original:', compressErr);
      }
    }
    
    try {
      const filePath = `${userId}/clips/${savedClip.id}-${sanitizedTitle}.mp4`;
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from('clips')
        .upload(filePath, finalBlob, { contentType: 'video/mp4', upsert: true });

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
          if (updateErr) console.error('Error updating clip row with watermarked URL:', updateErr);
        }
      }
    } catch (uploadErr) {
      console.error('Failed uploading/updating watermarked clip:', uploadErr);
    }

    // Return the watermarked MP4 to the caller (no streaming until finished)
    const buf = await wmBlob.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(buf.byteLength),
        'Content-Disposition': `attachment; filename="${sanitizedTitle}.mp4"`,
        'X-Clip-Id': String(savedClip.id),
        'X-Watermarked': 'true',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error in watermark-clip:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
