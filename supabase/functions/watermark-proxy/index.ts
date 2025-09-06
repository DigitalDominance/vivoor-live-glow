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
    "Access-Control-Expose-Headers": "Content-Disposition, Content-Type",
  };
  if (allowOrigin !== "*") headers["Access-Control-Allow-Credentials"] = "true";
  return headers;
}
// --------------------------

const WATERMARK_API_URL = "https://vivoor-e15c882142f5.herokuapp.com/watermark";

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries} - Calling watermark API`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response;
      
    } catch (error) {
      lastError = error as Error;
      console.error(`Attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error("All retry attempts failed");
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
        // Parse incoming body. We support both JSON and multipart/form-data.
    const contentType = req.headers.get("content-type") || "";
    let body: any = {};
    let videoFile: File | null = null;
    try {
      if (contentType.includes("multipart/form-data")) {
        const fd = await req.formData();
        // Extract known fields
        const v = fd.get("video");
        if (v && v instanceof File) videoFile = v as File;
        const urlVal = fd.get("videoUrl");
        const posVal = fd.get("position");
        const marginVal = fd.get("margin");
        const wmWidthVal = fd.get("wmWidth");
        const filenameVal = fd.get("filename");
        body = {
          videoUrl: typeof urlVal === "string" ? urlVal : undefined,
          position: typeof posVal === "string" ? posVal : undefined,
          margin: typeof marginVal === "string" ? Number(marginVal) : undefined,
          wmWidth: typeof wmWidthVal === "string" ? Number(wmWidthVal) : undefined,
          filename: typeof filenameVal === "string" ? filenameVal : undefined,
        };
      } else {
        body = await req.json().catch(() => ({}));
      }
    } catch {
      body = {};
    }
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

    console.log("Calling watermark API with params:", { videoUrl, position, margin, wmWidth, filename });

    // Call upstream watermark service with retry
    const upstream = await fetchWithRetry(
      WATERMARK_API_URL,
      { 
        method: "POST", 
        body: form,
        headers: {
          // Let FormData set its own Content-Type with boundary
        }
      },
      3
    );

    console.log("Watermark API response status:", upstream.status);

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      console.error("Watermark API error:", text);
      return new Response(
        JSON.stringify({
          error: "Watermark service failed",
          status: upstream.status,
          details: text,
        }),
        { 
          status: upstream.status || 502, 
          headers: { ...baseCors, "Content-Type": "application/json" } 
        },
      );
    }

    if (!upstream.body) {
      return new Response(
        JSON.stringify({ error: "No response body from watermark service" }),
        { 
          status: 502, 
          headers: { ...baseCors, "Content-Type": "application/json" } 
        }
      );
    }

    // Stream the mp4 straight back to the browser with proper CORS
    const contentType = upstream.headers.get("Content-Type") || "video/mp4";
    const contentDisposition = upstream.headers.get("Content-Disposition") || 
      `attachment; filename="${filename.replace(/[^a-zA-Z0-9_.-]/g, "_")}"`;

    console.log("Streaming watermarked video back to client");

    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...baseCors,
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
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
