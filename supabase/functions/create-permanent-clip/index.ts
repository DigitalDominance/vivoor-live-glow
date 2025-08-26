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
  };
  if (allowOrigin !== "*") headers["Access-Control-Allow-Credentials"] = "true";
  return headers;
}
// --------------------------

const LIVEPEER_API_KEY = Deno.env.get("LIVEPEER_API_KEY") ?? "";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function fetchWithRetry(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
  attempts = 3,
): Promise<Response> {
  const timeoutMs = init.timeoutMs ?? 15000;
  for (let i = 1; i <= attempts; i++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: { Accept: "application/json", ...(init.headers || {}) },
      });
      clearTimeout(t);
      if (!res.ok && (res.status >= 500 || res.status === 429)) {
        if (i === attempts) return res;
      } else {
        return res;
      }
    } catch {
      clearTimeout(t);
      if (i === attempts) throw new Error("network error");
    }
    await sleep(Math.min(8000, 500 * 2 ** (i - 1)));
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
    if (!LIVEPEER_API_KEY) {
      return new Response(JSON.stringify({ error: "LIVEPEER_API_KEY missing" }), {
        status: 500,
        headers: { ...baseCors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { playbackId, seconds, nowMs } = body as {
      playbackId?: string;
      seconds?: number;
      nowMs?: number;
    };

    if (!playbackId || !seconds) {
      return new Response(JSON.stringify({ error: "Missing playbackId or seconds" }), {
        status: 400,
        headers: { ...baseCors, "Content-Type": "application/json" },
      });
    }

    // compute window (use client clock if provided)
    const BASE_BUFFER_SECONDS = 25;
    const now = typeof nowMs === "number" && isFinite(nowMs) ? nowMs : Date.now();
    const endTime = now - BASE_BUFFER_SECONDS * 1000;
    const startTime = endTime - seconds * 1000;

    const postClip = (s: number, e: number, note?: string) =>
      fetchWithRetry(
        "https://livepeer.studio/api/clip",
        {
          method: "POST",
          timeoutMs: 15000,
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
        },
        3,
      );

    let clipRes = await postClip(startTime, endTime);
    if (!clipRes.ok) {
      // retry once with bigger buffer to avoid segment edge
      const retryBuffer = BASE_BUFFER_SECONDS + 20;
      const retryEnd = now - retryBuffer * 1000;
      const retryStart = retryEnd - seconds * 1000;
      const retryRes = await postClip(retryStart, retryEnd, "(retry)");
      if (!retryRes.ok) {
        const err1 = await clipRes.text().catch(() => "");
        const err2 = await retryRes.text().catch(() => "");
        return new Response(
          JSON.stringify({ error: "Livepeer /clip failed", details: err1, retry: err2 }),
          { status: 500, headers: { ...baseCors, "Content-Type": "application/json" } },
        );
      }
      clipRes = retryRes;
    }

    const js = await clipRes.json().catch(() => ({} as any));
    const assetId = js?.asset?.id as string | undefined;
    if (!assetId) {
      return new Response(JSON.stringify({ error: "Unexpected Livepeer response", response: js }), {
        status: 500,
        headers: { ...baseCors, "Content-Type": "application/json" },
      });
    }

    // Return quickly so the browser can poll (avoids 60s Edge limit)
    return new Response(JSON.stringify({ assetId }), {
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
