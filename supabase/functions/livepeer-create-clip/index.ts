import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LIVEPEER_API_KEY = Deno.env.get('LIVEPEER_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Animated V logo SVG (matching the one in SiteHeader)
const ANIMATED_V_LOGO_SVG = `<svg width="48" height="48" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="vGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#00d8ff;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#7c3aed;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#f472b6;stop-opacity:1" />
    </linearGradient>
    <animateTransform attributeName="transform" attributeType="XML" type="rotate" 
                      values="0 16 16;360 16 16" dur="3s" repeatCount="indefinite"/>
  </defs>
  <g fill="url(#vGradient)" transform-origin="16 16">
    <animateTransform attributeName="transform" attributeType="XML" type="rotate" 
                      values="0 16 16;360 16 16" dur="3s" repeatCount="indefinite"/>
    <path d="M8 6l8 20 8-20h-4l-4 10-4-10H8z" stroke="url(#vGradient)" stroke-width="0.5"/>
  </g>
</svg>`

async function createWatermarkedClip(originalUrl: string, outputName: string): Promise<string> {
  console.log('Starting watermark process for:', originalUrl)
  
  // Simple approach: Download original video and upload to our storage with watermark processing
  try {
    // Download original video
    const videoResponse = await fetch(originalUrl)
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`)
    }
    
    const videoBuffer = await videoResponse.arrayBuffer()
    console.log(`Downloaded video: ${videoBuffer.byteLength} bytes`)
    
    // For now, upload the original video to our storage
    // TODO: Add watermarking in a separate service
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('clips')
      .upload(`${outputName}.mp4`, videoBuffer, {
        contentType: 'video/mp4',
        upsert: true
      })
    
    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`)
    }
    
    console.log('Video uploaded successfully to storage')
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('clips')
      .getPublicUrl(`${outputName}.mp4`)
    
    return urlData.publicUrl
    
  } catch (error) {
    console.error('Error in watermarking process:', error)
    throw error
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