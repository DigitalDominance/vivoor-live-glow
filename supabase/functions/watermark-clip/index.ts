// supabase/functions/watermark-clip/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Disposition, X-Clip-Id, X-Watermarked",
};

const LIVEPEER_API_KEY = Deno.env.get("LIVEPEER_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const WATERMARK_URL = Deno.env.get("WATERMARK_URL") || "https://vivoor-e15c882142f5.herokuapp.com/watermark";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!LIVEPEER_API_KEY) {
      return new Response(JSON.stringify({ error: "LIVEPEER_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Supabase credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // body from UI
    const {
      playbackId,
      seconds,
      title,
      userId,
      streamTitle,
      startTime,
      endTime,
    } = await req.json();

    if (!playbackId || !seconds || !userId) {
      return new Response(JSON.stringify({ error: "Missing required fields: playbackId, seconds, userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Create Livepeer clip
    const clipBody: any = {
      playbackId,
      clipLength: Number(seconds),
      startTime: startTime ? Number(startTime) : undefined,
      endTime: endTime ? Number(endTime) : undefined,
      name: `Live Clip ${seconds}s - ${new Date().toISOString()}`,
    };

    const clipResponse = await fetch("https://livepeer.studio/api/clip", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LIVEPEER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(clipBody),
    });

    if (!clipResponse.ok) {
      const t = await clipResponse.text().catch(() => "");
      console.error("Livepeer clip creation failed:", t);
      return new Response(JSON.stringify({ error: "Failed to create clip via Livepeer API" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { asset } = await clipResponse.json();
    // 2) Poll asset ready
    let assetReady: any = null;
    for (let i = 0; i < 30; i++) {
      const r = await fetch(`https://livepeer.studio/api/asset/${asset.id}`, {
        headers: { Authorization: `Bearer ${LIVEPEER_API_KEY}` },
      });
      if (!r.ok) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      const j = await r.json();
      const phase = j?.status?.phase;
      if (phase === "ready") {
        assetReady = j;
        break;
      }
      if (phase === "failed") {
        return new Response(JSON.stringify({ error: "Livepeer asset failed to process" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!assetReady) {
      return new Response(JSON.stringify({ error: "Asset processing timeout" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clipTitle = (title || `${streamTitle || "Clip"} - ${seconds}s Clip`).trim();
    const sanitizedTitle = clipTitle.replace(/[^A-Za-z0-9._-]/g, "_") || "clip";

    // 3) Watermark via Heroku
    const form = new FormData();
    form.set("videoUrl", assetReady.downloadUrl);
    form.set("position", "br");
    form.set("margin", String(24));
    form.set("wmWidth", String(180));
    form.set("filename", `${sanitizedTitle}.mp4`);

    const wmRes = await fetch(WATERMARK_URL, { method: "POST", body: form });

    if (!wmRes.ok || !wmRes.body) {
      const txt = await wmRes.text().catch(() => "");
      console.error("Watermark service failed:", wmRes.status, txt);
      return new Response(JSON.stringify({ error: "Watermarking failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) Buffer watermarked bytes
    const wmBlob = await wmRes.blob();
    const wmBuf = await wmBlob.arrayBuffer();

    // 5) Upload to Storage (same bucket & format as non-watermarked flow)
    const storage = supabase.storage.from("clips");
    const filePath = `users/${userId}/clips/${asset.id}-${Date.now()}.mp4`;
    const uploadRes = await storage.upload(filePath, wmBlob, {
      contentType: "video/mp4",
      upsert: true,
    });

    if ((uploadRes as any)?.error) {
      console.error("Storage upload failed:", (uploadRes as any).error);
      return new Response(JSON.stringify({ error: "Failed to store watermarked clip" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pub = storage.getPublicUrl(filePath);
    const watermarkedUrl = pub?.data?.publicUrl || "";
    if (!watermarkedUrl) {
      return new Response(JSON.stringify({ error: "Could not resolve public URL for stored clip" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6) Insert clip row EXACTLY like the non-watermarked flow, but with watermarked URL
    const { data: savedClipRec, error: insertErr } = await supabase
      .from("clips")
      .insert({
        title: clipTitle,
        user_id: userId,
        start_seconds: 0,
        end_seconds: seconds,
        download_url: watermarkedUrl,
        thumbnail_url: watermarkedUrl,
        playback_id: playbackId,
        livepeer_asset_id: asset.id,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Error saving watermarked clip to database:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to save watermarked clip to database" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7) Return the bytes as a Blob (UI expects responseType:'blob')
    return new Response(wmBuf, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/octet-stream",
        "Content-Length": String(wmBuf.byteLength),
        "Content-Disposition": `attachment; filename="${sanitizedTitle}.mp4"`,
        "X-Clip-Id": String(savedClipRec.id),
        "X-Watermarked": "true",
        "Cache-Control": "no-store",
        "Pragma": "no-cache",
      },
    });
  } catch (err: any) {
    console.error("Error in watermark-clip:", err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
