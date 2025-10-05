// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { name } = await req.json();
    const API_KEY = Deno.env.get("LIVEPEER_API_KEY");
    if (!API_KEY) {
      return new Response(JSON.stringify({ error: "LIVEPEER_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const createRes = await fetch("https://livepeer.studio/api/stream", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name || `vivoor-${Date.now()}`,
        record: false, // Disable recording to save storage costs
        profiles: [
          { name: "720p60", bitrate: 3500000, fps: 60, width: 1280, height: 720 },
          { name: "720p30", bitrate: 2500000, fps: 30, width: 1280, height: 720 },
          { name: "480p30", bitrate: 1200000, fps: 30, width: 854, height: 480 },
          { name: "360p30", bitrate: 600000, fps: 30, width: 640, height: 360 },
        ],
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      return new Response(JSON.stringify({ error: "Livepeer error", details: err }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload: any = await createRes.json();
    
    // Log the full payload for debugging
    console.log('[livepeer-create-stream] Full Livepeer API response:', JSON.stringify(payload, null, 2));
    
    const streamId = payload.id;
    const playbackId = payload.playbackId || payload.playback_id;
    const ingestUrl = payload.rtmpIngestUrl || "rtmp://rtmp.livepeer.studio/live";
    const streamKey = payload.streamKey;
    
    // CRITICAL: Use the playback URL that Livepeer provides in their response
    // They return regional CDN URLs that work properly (e.g., mdw-prod-catalyst-0.lp-playback.studio)
    // Check multiple possible fields where Livepeer might return the playback URL
    let playbackUrl = null;
    
    if (payload.playbackUrl) {
      playbackUrl = payload.playbackUrl;
      console.log('[livepeer-create-stream] Using playbackUrl from payload:', playbackUrl);
    } else if (payload.playback?.hls) {
      playbackUrl = payload.playback.hls;
      console.log('[livepeer-create-stream] Using playback.hls from payload:', playbackUrl);
    } else if (playbackId) {
      // Fallback: construct URL if Livepeer doesn't provide one
      playbackUrl = `https://livepeercdn.studio/hls/${playbackId}/index.m3u8`;
      console.log('[livepeer-create-stream] Constructed fallback URL:', playbackUrl);
    }
    
    console.log('[livepeer-create-stream] Final URLs:', {
      streamId,
      playbackId,
      playbackUrl,
      ingestUrl
    });

    return new Response(JSON.stringify({ streamId, playbackId, ingestUrl, streamKey, playbackUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "Unexpected error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
