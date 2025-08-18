// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://qcowmxypihinteajhnjw.supabase.co",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
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
        record: true,
        profiles: [
          { name: "2160p60", bitrate: 14000000, fps: 60, width: 3840, height: 2160 },
          { name: "1440p60", bitrate: 10000000, fps: 60, width: 2560, height: 1440 },
          { name: "1080p60", bitrate: 6000000, fps: 60, width: 1920, height: 1080 },
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
    const playbackId = payload.playbackId || payload.playback_id || payload.playback?.id;
    const ingestUrl = payload.rtmpIngestUrl || payload.ingest || payload.ingestUrl || "rtmp://rtmp.livepeer.com/live";
    const streamKey = payload.streamKey || payload.stream_key;
    const playbackUrl = playbackId ? `https://livepeercdn.com/hls/${playbackId}/index.m3u8` : null;

    return new Response(JSON.stringify({ playbackId, ingestUrl, streamKey, playbackUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "Unexpected error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
