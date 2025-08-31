import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    // Expose filename header to the browser if needed
    "Access-Control-Expose-Headers": "Content-Disposition, Content-Type",
  };
  if (allowOrigin !== "*") headers["Access-Control-Allow-Credentials"] = "true";
  return headers;
}
// --------------------------

const WATERMARK_URL = "https://vivoor-e15c882142f5.herokuapp.com/watermark";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function fetchWithRetry(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
  attempts = 2,
): Promise<Response> {
  const timeoutMs = init.timeoutMs ?? 25000;
  for (let i = 1; i <= attempts; i++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: { ...(init.headers || {}) },
      });
      clearTimeout(t);
      // Accept only 2xx
      if (!res.ok) {
        if (i === attempts) return res;
      } else {
        return res;
      }
    } catch (_err) {
      clearTimeout(t);
      if (i === attempts) throw _err;
    }
    await sleep(Math.min(6000, 500 * 2 ** (i - 1)));
  }
  throw new Error("fetchWithRetry exhausted");
}

serve(async (req: Request) => {
  const baseCors = corsHeaders(req);

  // Preflight must return 200 + CORS
  if (req.method === "OPTIONS") {
    return new Response("", { status: 200, headers: baseCors });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: baseCors });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      videoUrl,
      position = "br",
      margin = 24,
      wmWidth = 180,
      filename = "clip.mp4",
    } = body as {
      videoUrl?: string;
      position?: string;
      margin?: number;
      wmWidth?: number;
      filename?: string;
    };

    if (!videoUrl) {
      return new Response(JSON.stringify({ error: "Missing videoUrl" }), {
        status: 400,
        headers: { ...baseCors, "Content-Type": "application/json" },
      });
    }

    // Build form-data for the upstream Heroku service
    const form = new FormData();
    form.set("videoUrl", videoUrl);
    form.set("position", position);
    form.set("margin", String(margin));
    form.set("wmWidth", String(wmWidth));
    form.set("filename", filename);

    // Call upstream watermark service with retry
    const upstream = await fetchWithRetry(
      WATERMARK_URL,
      { method: "POST", body: form, timeoutMs: 25000 },
      2,
    );

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      return new Response(
        JSON.stringify({
          error: "Watermark service failed",
          status: upstream.status,
          details: text,
        }),
        { status: upstream.status || 502, headers: { ...baseCors, "Content-Type": "application/json" } },
      );
    }

    // Stream the mp4 straight back to the browser with proper CORS
    const ct = upstream.headers.get("Content-Type") || "video/mp4";
    const disp =
      upstream.headers.get("Content-Disposition") ||
      `inline; filename="${filename.replace(/[^a-zA-Z0-9_.-]/g, "_")}"`;

    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...baseCors,
        "Content-Type": ct,
        "Content-Disposition": disp,
        // Prevent caching of transient results
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
