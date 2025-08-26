import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LIVEPEER_API_KEY = Deno.env.get("LIVEPEER_API_KEY")!;
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
      console.error("[create-permanent-clip] LIVEPEER_API_KEY is not set.");
      return new Response(
        JSON.stringify({ error: "LIVEPEER_API_KEY is not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[create-permanent-clip] Supabase env not set.");
      return new Response(
        JSON.stringify({ error: "Supabase environment variables are not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const { playbackId, seconds, title, userId, streamTitle } = body as {
      playbackId?: string;
      seconds?: number;
      title?: string;
      userId?: string;
      streamTitle?: string;
    };

    if (!playbackId || !seconds || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: playbackId, seconds, userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[create-permanent-clip] Creating ${seconds}s clip for ${playbackId}`);

    // Compute clipping window: from now going backwards with a safety buffer.
    const BASE_BUFFER_SECONDS = 25; // larger buffer avoids live segment edge issues
    const nowMs = Date.now();
    let endTime = nowMs - BASE_BUFFER_SECONDS * 1000;
    let startTime = endTime - seconds * 1000;

    console.log(
      `[create-permanent-clip] Window: ${new Date(startTime).toISOString()} → ${new Date(endTime).toISOString()}`,
    );

    // Helper to call Livepeer /clip
    const createClip = async (s: number, e: number, note = "") => {
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
          // NOTE: do NOT include sessionId when only playbackId is known.
        }),
      });
      return res;
    };

    // First attempt
    let clipResponse = await createClip(startTime, endTime);

    // Retry once with larger buffer if the first attempt fails (common timing issue)
    if (!clipResponse.ok) {
      const errorText = await clipResponse.text();
      console.error("[create-permanent-clip] Livepeer clip failed:", errorText);

      const retryBuffer = BASE_BUFFER_SECONDS + 20;
      const retryEnd = nowMs - retryBuffer * 1000;
      const retryStart = retryEnd - seconds * 1000;

      console.log(
        `[create-permanent-clip] Retrying with buffer=${retryBuffer}s: ${new Date(retryStart).toISOString()} → ${new Date(retryEnd).toISOString()}`,
      );

      const retryRes = await createClip(retryStart, retryEnd, "(retry)");
      if (!retryRes.ok) {
        const retryErr = await retryRes.text();
        console.error("[create-permanent-clip] Retry failed:", retryErr);
        return new Response(
          JSON.stringify({
            error: "Failed to create clip via Livepeer API",
            details: errorText,
            retry: retryErr,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      clipResponse = retryRes;
    }

    // Parse Livepeer response: expect { asset }
    const clipJson = await clipResponse.json();
    const asset = clipJson.asset;
    if (!asset?.id) {
      console.error("[create-permanent-clip] Unexpected clip response:", clipJson);
      return new Response(
        JSON.stringify({ error: "Unexpected response from Livepeer /clip", clipJson }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    console.log("[create-permanent-clip] Asset created:", asset.id);

    // Poll for readiness
    let attempts = 0;
    const maxAttempts = 30;
    let readyAsset: any = null;

    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 3000));
      const statusRes = await fetch(`https://livepeer.studio/api/asset/${asset.id}`, {
        headers: { Authorization: `Bearer ${LIVEPEER_API_KEY}` },
      });

      if (!statusRes.ok) {
        const t = await statusRes.text();
        console.warn(`[create-permanent-clip] Status check ${attempts + 1} failed:`, t);
        attempts++;
        continue;
      }

      const statusJson = await statusRes.json();
      const phase = statusJson?.status?.phase;
      console.log(`[create-permanent-clip] Status ${attempts + 1}: ${phase}`);
      if (phase === "ready") {
        readyAsset = statusJson;
        break;
      }
      if (phase === "failed") {
        return new Response(
          JSON.stringify({ error: "Asset processing failed at Livepeer." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      attempts++;
    }

    if (!readyAsset) {
      return new Response(
        JSON.stringify({ error: "Timeout waiting for clip to become ready." }),
        { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const downloadUrl: string | undefined =
      readyAsset?.downloadUrl || readyAsset?.files?.[0]?.downloadUrl;
    if (!downloadUrl) {
      return new Response(
        JSON.stringify({ error: "No download URL found for the processed asset." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Save a DB record for the clip (store canonical Livepeer URL)
    const clipTitle = title || `${streamTitle || "Stream"} - ${seconds}s Clip`;
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
        livepeer_asset_id: readyAsset?.id ?? asset.id,
      })
      .select("*")
      .single();

    if (saveError) {
      console.error("[create-permanent-clip] DB save error:", saveError);
      return new Response(
        JSON.stringify({ error: "Failed to save clip metadata.", details: saveError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Respond with URLs usable by the UI
    return new Response(
      JSON.stringify({
        clip: savedClip,
        downloadUrl,
        playbackUrl: downloadUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[create-permanent-clip] Uncaught error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
