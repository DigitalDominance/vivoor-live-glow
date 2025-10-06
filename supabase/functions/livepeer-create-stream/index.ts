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
    
    // IMPORTANT: Fetch the actual playback URL from Livepeer's stream endpoint
    // This will give us the regional CDN URL that actually works
    let playbackUrl = null;
    
    try {
      const streamInfoRes = await fetch(`https://livepeer.studio/api/stream/${streamId}`, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
        },
      });
      
      if (streamInfoRes.ok) {
        const streamInfo: any = await streamInfoRes.json();
        console.log('[livepeer-create-stream] Stream info response:', JSON.stringify(streamInfo, null, 2));
        
        // Try to get playback URL from various possible fields
        if (streamInfo.playbackUrl) {
          playbackUrl = streamInfo.playbackUrl;
          console.log('[livepeer-create-stream] Using playbackUrl from stream info');
        } else if (streamInfo.playback?.hls) {
          playbackUrl = streamInfo.playback.hls;
          console.log('[livepeer-create-stream] Using playback.hls from stream info');
        }
      }
    } catch (error) {
      console.error('[livepeer-create-stream] Failed to fetch stream info:', error);
    }
    
    // Fallback to constructed URL if we couldn't get it from API
    if (!playbackUrl && playbackId) {
      playbackUrl = `https://livepeercdn.studio/hls/${playbackId}/index.m3u8`;
      console.log('[livepeer-create-stream] Using constructed fallback URL');
    }
    
    // CRITICAL: Always rewrite any playback.livepeer.studio URLs to livepeercdn.studio
    if (playbackUrl && playbackUrl.includes('playback.livepeer.studio')) {
      playbackUrl = playbackUrl.replace('playback.livepeer.studio', 'livepeercdn.studio');
      console.log('[livepeer-create-stream] Rewrote playback URL to use CDN:', playbackUrl);
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
