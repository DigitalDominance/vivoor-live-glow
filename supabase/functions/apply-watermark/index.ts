import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// This edge function acts as a simple proxy to the Vivoor watermark API. It
// accepts JSON input specifying the source clip URL and optional watermark
// parameters, then forwards the request to the Heroku watermark service using
// FormData.  The response, which is a binary MP4 stream, is forwarded back
// to the caller along with the original content headers.  This proxy avoids
// CORS issues because the browser interacts with your Supabase domain while
// the function makes the cross-origin call server-to-server.

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { videoUrl, position = 'br', margin = 24, wmWidth, filename } = await req.json();

    if (!videoUrl || typeof videoUrl !== 'string') {
      return new Response(
        JSON.stringify({ error: "'videoUrl' is required and must be a string" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formData = new FormData();
    formData.append('videoUrl', videoUrl);
    formData.append('position', String(position));
    formData.append('margin', String(margin));
    if (wmWidth !== undefined && wmWidth !== null) {
      formData.append('wmWidth', String(wmWidth));
    }
    if (filename) {
      formData.append('filename', String(filename));
    }

    // Forward the request to the Vivoor watermark API.  Because this call
    // originates server-side, CORS restrictions do not apply.  If the
    // downstream service fails we surface the error back to the caller.
    const wmResponse = await fetch('https://vivoor-e15c882142f5.herokuapp.com/watermark', {
      method: 'POST',
      body: formData,
    });

    if (!wmResponse.ok || !wmResponse.body) {
      const errorText = await wmResponse.text().catch(() => '');
      return new Response(
        JSON.stringify({ error: `Watermark service responded with ${wmResponse.status}`, details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Forward the binary stream back to the caller.  Copy over useful
    // headers such as Content-Type and Content-Disposition so the browser
    // treats the response correctly.
    const headers = new Headers(corsHeaders);
    const ct = wmResponse.headers.get('content-type');
    if (ct) headers.set('Content-Type', ct);
    const cd = wmResponse.headers.get('content-disposition');
    if (cd) headers.set('Content-Disposition', cd);

    return new Response(wmResponse.body, { headers });

  } catch (error: any) {
    console.error('apply-watermark error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});