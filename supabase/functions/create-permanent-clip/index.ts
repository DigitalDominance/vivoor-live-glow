import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LIVEPEER_API_KEY = Deno.env.get('LIVEPEER_API_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { playbackId, seconds, title, userId, streamTitle } = await req.json();

    if (!playbackId || !seconds || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: playbackId, seconds, userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting ${seconds}s clip creation for playbackId: ${playbackId}`);

    // Create a pending clip record immediately
    const clipTitle = title || `Live Clip ${seconds}s - ${new Date().toISOString()}`;
    const { data: pendingClip, error: pendingError } = await supabaseClient
      .from('clips')
      .insert({
        title: clipTitle,
        user_id: userId,
        start_seconds: 0,
        end_seconds: seconds,
        playback_id: playbackId,
        // Mark as processing with null URLs
        download_url: null,
        thumbnail_url: null,
      })
      .select()
      .single();

    if (pendingError) {
      console.error('Error creating pending clip:', pendingError);
      throw new Error('Failed to create pending clip record');
    }

    console.log('Pending clip created:', pendingClip.id);

    // Start background processing without awaiting
    const backgroundProcessing = async () => {
      try {
        console.log(`Processing clip ${pendingClip.id} in background`);

        // 1. Create clip via Livepeer API with buffer
        const BUFFER_SECONDS = 13;
        const now = Date.now();
        const endTime = now - (BUFFER_SECONDS * 1000);
        const startTime = endTime - (seconds * 1000);
        
        console.log(`Clipping from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()} (${seconds}s duration with ${BUFFER_SECONDS}s buffer)`);

        const clipResponse = await fetch('https://livepeer.studio/api/clip', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LIVEPEER_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            playbackId,
            startTime,
            endTime,
            name: `Live Clip ${seconds}s - ${new Date().toISOString()}`
          }),
        });

        if (!clipResponse.ok) {
          const errorText = await clipResponse.text();
          console.error('Livepeer clip creation failed:', errorText);
          throw new Error('Failed to create clip via Livepeer API');
        }

        const { asset } = await clipResponse.json();
        console.log('Livepeer clip asset created:', asset.id);

        // 2. Wait for the asset to be ready
        let attempts = 0;
        const maxAttempts = 30;
        let assetReady = null;

        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 3000));

          const statusResponse = await fetch(`https://livepeer.studio/api/asset/${asset.id}`, {
            headers: {
              'Authorization': `Bearer ${LIVEPEER_API_KEY}`,
            },
          });

          if (statusResponse.ok) {
            const assetData = await statusResponse.json();
            console.log(`Asset status check ${attempts + 1}: ${assetData.status?.phase}`);
            
            if (assetData.status?.phase === 'ready') {
              assetReady = assetData;
              break;
            }
            
            if (assetData.status?.phase === 'failed') {
              throw new Error('Asset processing failed');
            }
          }
          
          attempts++;
        }

        if (!assetReady) {
          throw new Error('Asset processing timeout');
        }

        console.log('Asset ready, downloading and watermarking...');

        // 3. Download the clip from Livepeer
        const clipData = await fetch(assetReady.downloadUrl);
        if (!clipData.ok) {
          throw new Error('Failed to download clip from Livepeer');
        }

        // 4. Send to watermark service
        const formData = new FormData();
        formData.append('video', await clipData.blob(), 'clip.mp4');
        formData.append('position', 'br');
        formData.append('margin', '24');
        formData.append('wmWidth', '180');
        
        const filename = `${clipTitle.replace(/[^a-zA-Z0-9]/g, '-')}.mp4`;
        formData.append('filename', filename);

        const watermarkResponse = await fetch('https://vivoor-e15c882142f5.herokuapp.com/watermark', {
          method: 'POST',
          body: formData,
        });

        if (!watermarkResponse.ok) {
          throw new Error('Watermarking failed');
        }

        // 5. Get watermarked video
        const watermarkedBlob = await watermarkResponse.blob();
        const watermarkedBuffer = await watermarkedBlob.arrayBuffer();

        // 6. Upload to Supabase storage
        const clipFilename = `${userId}/${Date.now()}-${filename}`;
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
          .from('clips')
          .upload(clipFilename, watermarkedBuffer, {
            contentType: 'video/mp4',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error('Failed to upload clip to storage');
        }

        console.log('Clip uploaded to storage:', uploadData.path);

        // 7. Get public URL
        const { data: urlData } = supabaseClient.storage
          .from('clips')
          .getPublicUrl(clipFilename);

        const publicUrl = urlData.publicUrl;

        // 8. Update clip record with final URLs
        const { error: updateError } = await supabaseClient
          .from('clips')
          .update({
            download_url: publicUrl,
            thumbnail_url: publicUrl,
            livepeer_asset_id: asset.id
          })
          .eq('id', pendingClip.id);

        if (updateError) {
          console.error('Error updating clip:', updateError);
          throw new Error('Failed to update clip record');
        }

        console.log('Clip successfully processed and updated:', pendingClip.id);

      } catch (error) {
        console.error('Background processing error:', error);
        
        // Mark clip as failed
        await supabaseClient
          .from('clips')
          .update({
            download_url: 'FAILED',
            thumbnail_url: 'FAILED'
          })
          .eq('id', pendingClip.id);
      }
    };

    // Use waitUntil for background processing
    // @ts-ignore
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(backgroundProcessing());
    } else {
      // Fallback: start processing but don't await
      backgroundProcessing();
    }

    // Return immediately with the pending clip
    return new Response(
      JSON.stringify({
        success: true,
        clip: pendingClip,
        processing: true,
        message: 'Clip creation started. You will be notified when ready.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-permanent-clip:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});