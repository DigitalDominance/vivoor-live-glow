import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LIVEPEER_API_KEY = Deno.env.get("LIVEPEER_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    if (!LIVEPEER_API_KEY) {
      return new Response(JSON.stringify({ error: "LIVEPEER_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Supabase env vars missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { playbackId, seconds, title, userId, streamTitle, nowMs } = body as {
      playbackId?: string;
      seconds?: number;
      title?: string;
      userId?: string;
      streamTitle?: string;
      nowMs?: number;
    };

    if (!playbackId || !seconds || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: playbackId, seconds, userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Compute clipping window using client clock if provided to reduce drift.
    const BASE_BUFFER_SECONDS = 25; // base safety buffer to avoid live segment edges
    const now = typeof nowMs === "number" && isFinite(nowMs) ? nowMs : Date.now();
    let endTime = now - BASE_BUFFER_SECONDS * 1000;
    let startTime = endTime - seconds * 1000;

    // Helper to call Livepeer /clip WITHOUT sessionId (invalid with playbackId)
    const createClip = async (s: number, e: number, note?: string) => {
      const res = await fetch("https://livepeer.studio/api/clip", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LIVEPEER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playbackId,
          startTime: s,
          endTime: e,
          name: `Live Clip ${seconds}s - ${new Date().toISOString()}${note ? " " + note : ""}`,
        }),
      });
      return res;
    };

    // First attempt
    let clipResponse = await createClip(startTime, endTime);

    // Retry once with a larger buffer if first attempt fails (common live timing issue)
    if (!clipResponse.ok) {
      const err1 = await clipResponse.text().catch(() => "");
      const retryBuffer = BASE_BUFFER_SECONDS + 20;
      const retryEnd = now - retryBuffer * 1000;
      const retryStart = retryEnd - seconds * 1000;

      const retryRes = await createClip(retryStart, retryEnd, "(retry)");
      if (!retryRes.ok) {
        const err2 = await retryRes.text().catch(() => "");
        return new Response(
          JSON.stringify({ error: "Livepeer /clip failed", details: err1, retry: err2 }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      clipResponse = retryRes;
    }

    // Parse response
    const clipJson = await clipResponse.json().catch(() => ({} as any));
    const asset = (clipJson as any)?.asset;
    if (!asset?.id) {
      return new Response(
        JSON.stringify({ error: "Unexpected Livepeer response", response: clipJson }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Poll asset until ready
    let ready: any = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const st = await fetch(`https://livepeer.studio/api/asset/${asset.id}`, {
        headers: { Authorization: `Bearer ${LIVEPEER_API_KEY}` },
      });
      if (!st.ok) continue;

      const js = await st.json().catch(() => ({}));
      const phase = js?.status?.phase;
      if (phase === "ready") {
        ready = js;
        break;
      }
      if (phase === "failed") {
        return new Response(JSON.stringify({ error: "Asset processing failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!ready) {
      return new Response(JSON.stringify({ error: "Timeout waiting for asset ready" }), {
        status: 504,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const downloadUrl: string | undefined =
      ready?.downloadUrl || ready?.files?.[0]?.downloadUrl;

    if (!downloadUrl) {
      return new Response(JSON.stringify({ error: "No downloadUrl on Livepeer asset" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clipTitle = title || `${streamTitle || "Stream"} - ${seconds}s Clip`;

    // Persist clip metadata
    const { data: savedClip, error: saveError } = await supabase
      .from("clips")
      .insert({
        title: clipTitle,
        user_id: userId,
        start_seconds: 0,
        end_seconds: seconds,
        download_url: downloadUrl,
        thumbnail_url: downloadUrl,
        duration_seconds: seconds,
        livepeer_asset_id: ready?.id ?? asset.id,
        playback_id: playbackId,
      })
      .select("*")
      .single();

    if (saveError) {
      return new Response(
        JSON.stringify({ error: "DB insert failed", details: saveError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        clip: savedClip,
        downloadUrl,
        playbackUrl: downloadUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
