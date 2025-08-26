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
    const { assetId } = body as { assetId?: string };

    if (!assetId) {
      return new Response(JSON.stringify({ error: "Missing assetId" }), {
        status: 400,
        headers: { ...baseCors, "Content-Type": "application/json" },
      });
    }

    const st = await fetchWithRetry(`https://livepeer.studio/api/asset/${assetId}`, {
      timeoutMs: 15000,
      headers: { Authorization: `Bearer ${LIVEPEER_API_KEY}` },
    }, 3);

    if (!st.ok) {
      const t = await st.text().catch(() => "");
      return new Response(JSON.stringify({ error: "Status check failed", details: t }), {
        status: st.status,
        headers: { ...baseCors, "Content-Type": "application/json" },
      });
    }

    const js = await st.json().catch(() => ({} as any));
    const phase = js?.status?.phase as string | undefined;
    const downloadUrl: string | undefined = js?.downloadUrl || js?.files?.[0]?.downloadUrl;

    return new Response(JSON.stringify({ phase, downloadUrl }), {
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
