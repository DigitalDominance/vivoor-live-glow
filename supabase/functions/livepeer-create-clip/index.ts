import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LIVEPEER_API_KEY = Deno.env.get('LIVEPEER_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

    console.log(`Creating clip for playbackId: ${playbackId}, ${startTime}ms to ${endTime}ms`)

    // 1. Create clip via Livepeer API
    const clipResponse = await fetch('https://livepeer.studio/api/clip', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LIVEPEER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playbackId,
        startTime: Math.floor(startTime),
        endTime: Math.floor(endTime),
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

    // 2. Wait for the asset to be ready (poll status)
    let attempts = 0
    const maxAttempts = 60 // 5 minutes max
    let assetReady = null

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds

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

    console.log('Asset ready, downloadUrl:', assetReady.downloadUrl)

    // 3. Save clip metadata to Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const clipData = {
      user_id: userId,
      title: title || `Clip ${new Date().toISOString()}`,
      start_seconds: Math.floor(startTime / 1000),
      end_seconds: Math.floor(endTime / 1000),
      livepeer_asset_id: asset.id,
      download_url: assetReady.downloadUrl,
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

    // Return the clip data with download URL
    return new Response(
      JSON.stringify({
        clipId: clipRecord.id,
        downloadUrl: assetReady.downloadUrl,
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