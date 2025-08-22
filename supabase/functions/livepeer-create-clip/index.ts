import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LIVEPEER_API_KEY = Deno.env.get('LIVEPEER_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Kaspa logo SVG as base64 (animated spinning effect)
const KASPA_LOGO_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" width="48" height="48">
  <defs>
    <animateTransform attributeName="transform" attributeType="XML" type="rotate" 
                      from="0 32 32" to="360 32 32" dur="2s" repeatCount="indefinite"/>
  </defs>
  <g fill="#00D8CC" transform-origin="32 32">
    <animateTransform attributeName="transform" attributeType="XML" type="rotate" 
                      from="0 32 32" to="360 32 32" dur="2s" repeatCount="indefinite"/>
    <path d="M32 4l24 14v28L32 60 8 46V18L32 4zm0 6L14 20v24l18 10 18-10V20L32 10z"/>
    <path d="M22 40l8-8-8-8h8l8 8-8 8h-8z"/>
  </g>
</svg>`

async function createWatermarkedClip(originalUrl: string, outputName: string): Promise<string> {
  // Create temporary files
  const tempDir = await Deno.makeTempDir()
  const inputPath = `${tempDir}/input.mp4`
  const logoPath = `${tempDir}/logo.svg`
  const outputPath = `${tempDir}/output.mp4`
  
  try {
    // Download original video
    const videoResponse = await fetch(originalUrl)
    const videoBuffer = await videoResponse.arrayBuffer()
    await Deno.writeFile(inputPath, new Uint8Array(videoBuffer))
    
    // Create logo file
    await Deno.writeTextFile(logoPath, KASPA_LOGO_SVG)
    
    // Use FFmpeg to add watermark (spinning Kaspa logo bottom-right)
    const ffmpegCmd = new Deno.Command("ffmpeg", {
      args: [
        "-i", inputPath,
        "-i", logoPath,
        "-filter_complex", 
        `[1:v]scale=48:48[logo];[0:v][logo]overlay=(main_w-overlay_w-20):(main_h-overlay_h-20)`,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "20",
        "-c:a", "copy",
        "-y",
        outputPath
      ],
      stdout: "null",
      stderr: "null"
    })
    
    const ffmpegProcess = await ffmpegCmd.output()
    
    if (!ffmpegProcess.success) {
      throw new Error('FFmpeg processing failed')
    }
    
    // Read the watermarked video
    const watermarkedBuffer = await Deno.readFile(outputPath)
    
    // Upload to Supabase Storage
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('clips')
      .upload(`${outputName}.mp4`, watermarkedBuffer, {
        contentType: 'video/mp4',
        upsert: true
      })
    
    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`)
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('clips')
      .getPublicUrl(`${outputName}.mp4`)
    
    return urlData.publicUrl
    
  } finally {
    // Cleanup temp files
    try {
      await Deno.remove(tempDir, { recursive: true })
    } catch (e) {
      console.warn('Failed to cleanup temp files:', e)
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { playbackId, startTime, endTime, title, userId } = await req.json()

    if (!playbackId || typeof startTime !== 'number' || typeof endTime !== 'number') {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: playbackId, startTime, endTime' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Ensure precise timing - don't floor the values to preserve exact durations
    const preciseStartTime = Math.round(startTime)
    const preciseEndTime = Math.round(endTime)
    const durationMs = preciseEndTime - preciseStartTime
    
    console.log(`Creating clip for playbackId: ${playbackId}, ${preciseStartTime}ms to ${preciseEndTime}ms (duration: ${durationMs}ms)`)

    // 1. Create clip via Livepeer API
    const clipResponse = await fetch('https://livepeer.studio/api/clip', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LIVEPEER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playbackId,
        startTime: preciseStartTime,
        endTime: preciseEndTime,
        name: title || `Clip ${new Date().toISOString()}`
      }),
    })

    if (!clipResponse.ok) {
      const errorText = await clipResponse.text()
      console.error('Livepeer clip creation failed:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to create clip via Livepeer API' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { asset } = await clipResponse.json()
    console.log('Livepeer clip asset created:', asset.id)

    // 2. Wait for the asset to be ready (optimized polling)
    let attempts = 0
    const maxAttempts = 36 // 3 minutes max with faster polling
    let assetReady = null

    while (attempts < maxAttempts) {
      // Adaptive polling: start fast, then slow down
      const waitTime = attempts < 6 ? 2000 : attempts < 12 ? 3000 : 5000
      await new Promise(resolve => setTimeout(resolve, waitTime))

      const statusResponse = await fetch(`https://livepeer.studio/api/asset/${asset.id}`, {
        headers: {
          'Authorization': `Bearer ${LIVEPEER_API_KEY}`,
        },
      })

      if (statusResponse.ok) {
        const assetData = await statusResponse.json()
        console.log(`Asset status check ${attempts + 1}: ${assetData.status?.phase}`)
        
        if (assetData.status?.phase === 'ready') {
          assetReady = assetData
          break
        }
        
        if (assetData.status?.phase === 'failed') {
          throw new Error('Asset processing failed')
        }
      }
      
      attempts++
    }

    if (!assetReady) {
      throw new Error('Asset processing timeout')
    }

    console.log('Asset ready, starting watermarking process...')

    // 3. Create watermarked version with animated Kaspa logo
    const outputName = `clip-${asset.id}-${Date.now()}`
    const watermarkedUrl = await createWatermarkedClip(assetReady.downloadUrl, outputName)
    
    console.log('Watermarked clip created:', watermarkedUrl)

    // 4. Save clip metadata to Supabase with precise timing
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const clipData = {
      user_id: userId,
      title: title || `Clip ${new Date().toISOString()}`,
      start_seconds: Math.round(preciseStartTime / 1000),
      end_seconds: Math.round(preciseEndTime / 1000),
      livepeer_asset_id: asset.id,
      download_url: watermarkedUrl, // Use watermarked version
      playback_id: playbackId,
      thumbnail_url: assetReady.status?.updatedAt ? `${assetReady.playbackUrl}/thumbnails/thumbnail.jpg` : null
    }

    const { data: clipRecord, error: insertError } = await supabase
      .from('clips')
      .insert(clipData)
      .select('*')
      .single()

    if (insertError) {
      console.error('Failed to save clip to database:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to save clip metadata' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Clip saved successfully:', clipRecord.id)

    // Return the clip data with watermarked download URL
    return new Response(
      JSON.stringify({
        clipId: clipRecord.id,
        downloadUrl: watermarkedUrl,
        playbackUrl: assetReady.playbackUrl,
        thumbnailUrl: clipRecord.thumbnail_url,
        title: clipRecord.title
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in livepeer-create-clip:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})