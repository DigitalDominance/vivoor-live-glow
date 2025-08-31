import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Unified clip + watermark function.
 * - Creates a Livepeer clip (unless a direct videoUrl is provided)
 * - Calls the internal watermark-proxy (which hits Heroku /watermark)
 * - Uploads the resulting MP4 to Supabase Storage
 * - Returns JSON: { success, watermarked, url, filename, clipId }
 *
 * IMPORTANT: We deliberately return JSON (application/json). Previously this
 * function streamed an MP4 (video/mp4). Some clients (including supabase-js
 * when responseType isn't set) try to parse responses as text/JSON and throw
 * "Unexpected response from watermark service". Returning JSON removes that
 * class of error on the frontend.
 */

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function originFromRequest(req: Request) {
  const url = new URL(req.url);
  return url.origin;
}

function fnUrl(origin: string, name: string) {
  return `${origin}/functions/v1/${name}`;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const origin = originFromRequest(req);
    const body = await req.json().catch(() => ({} as any));

    const {
      // Either provide playbackId + seconds (and optional start/end) for Livepeer
      // or pass a direct videoUrl to watermark.
      playbackId,
      seconds,
      title,
      userId,
      streamTitle,
      startTime,
      endTime,
      videoUrl,                 // optional: skip Livepeer if present
      // Watermark placement (optional; defaults are sane)
      position = 'bottom-right',
      margin = 20,
      wmWidth = 240
    } = body || {};

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Create a service-role client to upload to Storage
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determine source URL for watermarking
    let sourceUrl: string | null = null;

    if (videoUrl && typeof videoUrl === 'string') {
      sourceUrl = videoUrl;
    } else {
      if (!playbackId || !seconds) {
        return new Response(JSON.stringify({ error: 'Missing required fields: playbackId or seconds' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Call internal Livepeer clip creator
      const lpResp = await fetch(fnUrl(origin, 'livepeer-create-clip'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playbackId,
          seconds,
          title,
          userId,
          streamTitle,
          startTime,
          endTime
        })
      });

      if (!lpResp.ok) {
        const t = await lpResp.text().catch(() => '');
        return new Response(JSON.stringify({ error: 'Failed to create clip via Livepeer', details: t }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const lpJson = await lpResp.json().catch(() => ({} as any));
      sourceUrl = lpJson?.downloadUrl || null;
      if (!sourceUrl) {
        return new Response(JSON.stringify({ error: 'Clip created but no downloadUrl present' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Build filename
    const safeTitle = (title || streamTitle || 'clip').toString().replace(/[^a-zA-Z0-9_. -]/g, '_').slice(0, 64);
    const stamp = Date.now();
    const filename = `${safeTitle}-${stamp}.mp4`;

    // Call internal watermark proxy which streams the MP4
    const form = new FormData();
    form.set('videoUrl', sourceUrl);
    form.set('position', position);
    form.set('margin', String(margin));
    form.set('wmWidth', String(wmWidth));
    form.set('filename', filename);

    const wmResp = await fetch(fnUrl(origin, 'watermark-proxy'), {
      method: 'POST',
      body: form
    });

    // If watermark failed, surface a soft failure (so caller can still get a clip)
    if (!wmResp.ok || (wmResp.headers.get('content-type') ?? '').includes('application/json')) {
      const maybeErr = await wmResp.text().catch(() => '');
      // In a pinch, pass through the original sourceUrl
      return new Response(JSON.stringify({
        success: true,
        watermarked: false,
        url: sourceUrl,
        filename,
        error: 'Watermark failed; returning unwatermarked clip',
        details: maybeErr
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Read the MP4 into memory (edge does allow moderate buffers); then upload
    const ab = await wmResp.arrayBuffer();
    const filePath = `watermarked/${userId}/${filename}`;

    const uploadRes = await supabase.storage.from('clips').upload(filePath, new Uint8Array(ab), {
      contentType: 'video/mp4',
      upsert: true
    });

    if (uploadRes.error) {
      // If upload fails, still return success with a temporary Blob URL? Can't from edge.
      // Fallback: return the unwatermarked source URL.
      return new Response(JSON.stringify({
        success: true,
        watermarked: false,
        url: sourceUrl,
        filename,
        error: 'Upload to storage failed',
        details: uploadRes.error.message
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const pub = supabase.storage.from('clips').getPublicUrl(filePath);
    const publicUrl = pub?.data?.publicUrl ?? null;

    return new Response(JSON.stringify({
      success: true,
      watermarked: true,
      url: publicUrl || sourceUrl,
      filename,
      clipId: `wmk-${stamp}`
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('watermark-clip error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error?.message || 'Internal server error'
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
