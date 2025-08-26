import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------- CORS ----------
const ALLOWED_ORIGINS = new Set<string>([
  "https://vivoor.xyz",
  "https://www.vivoor.xyz",
  "https://preview--vivoor-live-glow.lovable.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);
function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "*";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-authorization",
    "Access-Control-Max-Age": "86400",
  };
  if (allowOrigin !== "*") headers["Access-Control-Allow-Credentials"] = "true";
  return headers;
}
// --------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req: Request) => {
  const baseCors = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("", { status: 200, headers: baseCors });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: baseCors });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured: missing SUPABASE env vars" }),
        { status: 500, headers: { ...baseCors, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      title,
      userId,
      playbackId,
      livepeerAssetId,
      durationSeconds,
      startSeconds = 0,
      endSeconds,
      downloadUrl,
      thumbnailUrl,
      isWatermarked = true,
    } = body as {
      title?: string;
      userId?: string;
      playbackId?: string;
      livepeerAssetId?: string;
      durationSeconds?: number;
      startSeconds?: number;
      endSeconds?: number;
      downloadUrl?: string;
      thumbnailUrl?: string;
      isWatermarked?: boolean;
    };

    if (!title || !userId || !downloadUrl || !durationSeconds) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: title, userId, downloadUrl, durationSeconds",
        }),
        { status: 400, headers: { ...baseCors, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase
      .from("clips")
      .insert({
        title,
        user_id: userId,
        playback_id: playbackId,
        livepeer_asset_id: livepeerAssetId,
        duration_seconds: durationSeconds,
        start_seconds: startSeconds ?? 0,
        end_seconds: endSeconds ?? durationSeconds,
        download_url: downloadUrl,
        thumbnail_url: thumbnailUrl ?? downloadUrl,
        is_watermarked: isWatermarked,
      })
      .select("*")
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: "DB insert failed", details: error.message }),
        { status: 500, headers: { ...baseCors, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ clip: data }), {
      status: 200,
      headers: { ...baseCors, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...baseCors, "Content-Type": "application/json" },
    });
  }
});
