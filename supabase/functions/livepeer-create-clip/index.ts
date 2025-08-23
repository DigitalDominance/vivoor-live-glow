import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LIVEPEER_API_KEY = Deno.env.get('LIVEPEER_API_KEY')!

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { playbackId, seconds } = await req.json()

    if (!playbackId || !seconds) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: playbackId, seconds' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Creating ${seconds}s clip for playbackId: ${playbackId}`)

    // For live streams, we create a clip from the current time going backwards
    // This approach was working before - keeping it simple
    const now = Date.now()
    const endTime = Math.floor(now / 1000) // Current time in seconds
    const startTime = endTime - seconds // Go back by the specified duration
    
    console.log(`Clipping from ${startTime}s to ${endTime}s (${seconds}s duration)`)

    // Create clip via Livepeer API with proper timing
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

    // Wait for the asset to be ready
    let attempts = 0
    const maxAttempts = 30
    let assetReady = null

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000))

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

    console.log('Asset ready, returning download URL')

    // Return the download URL for watermarking
    return new Response(
      JSON.stringify({
        downloadUrl: assetReady.downloadUrl
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