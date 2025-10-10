import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatVerificationRequest {
  txid: string;
  streamId: string;
  senderAddress: string;
  sessionToken: string;
  walletAddress: string;
  displayMessage?: string; // Optional emoji version for display
}

interface KaspaTx {
  transaction_id: string;
  accepting_block_blue_score: number;
  block_time: number;
  is_accepted: boolean;
  payload?: string;
  inputs: Array<{
    signature_script?: string | null;
    utxo?: {
      address: string;
      amount: string;
    };
  }>;
  outputs: Array<{
    amount: number;
    script_public_key_address: string;
  }>;
}

// Parse chat message from plain text payload (no encryption)
function parseChatMessage(payloadData: string): {
  identifier: string;
  version: string;
  broadcast: string;
  streamId: string;
  messageContent: string;
} | null {
  try {
    let payloadText: string;
    
    // Check if payload is hex or plain text
    if (/^[0-9a-f]+$/i.test(payloadData)) {
      // It's hex, convert to string
      const bytes: number[] = [];
      for (let i = 0; i < payloadData.length; i += 2) {
        const byte = parseInt(payloadData.slice(i, i + 2), 16);
        if (!Number.isNaN(byte)) bytes.push(byte);
      }
      payloadText = new TextDecoder().decode(new Uint8Array(bytes));
    } else {
      // It's already plain text
      payloadText = payloadData;
    }
    
    console.log('[ChatVerify] Parsed payload text:', payloadText);
    
    // Parse format: ciph_msg:1:bcast:{streamID}:{message}
    const parts = payloadText.split(':');
    if (parts.length < 5) {
      console.error('[ChatVerify] Invalid payload format, parts:', parts);
      return null;
    }
    
    const identifier = parts[0]; // ciph_msg
    const version = parts[1]; // 1
    const broadcast = parts[2]; // bcast
    const streamId = parts[3];
    const messageContent = parts.slice(4).join(':'); // Handle colons in message
    
    // Verify format
    if (identifier !== 'ciph_msg' || version !== '1' || broadcast !== 'bcast') {
      console.error('[ChatVerify] Invalid format:', { identifier, version, broadcast });
      return null;
    }
    
    return { identifier, version, broadcast, streamId, messageContent };
  } catch (error) {
    console.error('[ChatVerify] Parse error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { 
      txid, 
      streamId, 
      senderAddress,
      sessionToken,
      walletAddress,
      displayMessage
    }: ChatVerificationRequest = await req.json()

    console.log('Verifying chat message transaction:', { txid, streamId, senderAddress, hasDisplayMessage: !!displayMessage })

    // Validate session token
    const { data: session, error: sessionError } = await supabaseClient
      .from('wallet_auth_sessions')
      .select('encrypted_user_id')
      .eq('session_token', sessionToken)
      .eq('wallet_address', walletAddress)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (sessionError || !session) {
      console.error('Invalid session:', sessionError)
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired session' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Validate txid format
    const cleanTxid = txid.trim()
    if (!/^[a-f0-9]{64}$/i.test(cleanTxid)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid transaction ID format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if already processed
    const { data: existingMessage } = await supabaseClient
      .from('chat_messages')
      .select('id')
      .eq('txid', cleanTxid)
      .single()

    if (existingMessage) {
      return new Response(
        JSON.stringify({ success: false, error: 'Message already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Wait and fetch transaction with retries until it's accepted
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    const maxRetries = 8
    let tx: KaspaTx | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const retryDelay = attempt * 5000
      try {
        console.log(`Fetching transaction (attempt ${attempt}/${maxRetries})`)
        const kaspaResponse = await fetch(
          `https://api.kaspa.org/transactions/${cleanTxid}?inputs=true&outputs=true&resolve_previous_outpoints=no`
        )
        
        if (!kaspaResponse.ok) {
          if (attempt === maxRetries) {
            throw new Error(`Failed after ${maxRetries} attempts: ${kaspaResponse.status}`)
          }
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          continue
        }

        const fetchedTx = await kaspaResponse.json()
        console.log('Transaction fetched successfully, is_accepted:', fetchedTx.is_accepted)
        
        // Only break if transaction is accepted
        if (fetchedTx.is_accepted) {
          tx = fetchedTx
          console.log('Transaction accepted!')
          break
        }
        
        // Transaction exists but not accepted yet, retry
        if (attempt < maxRetries) {
          console.log(`Transaction not accepted yet, waiting ${retryDelay}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
        
      } catch (error) {
        console.error(`Error on attempt ${attempt}:`, error)
        if (attempt === maxRetries) throw error
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
    }

    if (!tx) {
      throw new Error('Failed to fetch transaction data')
    }

    if (!tx.is_accepted) {
      return new Response(
        JSON.stringify({ success: false, error: 'Transaction not accepted after retries. Please wait and try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify transaction: 1.2 KAS (120000000 sompi) to sender's own address
    const expectedAmount = 120000000 // 1.2 KAS in sompi
    const outputToSelf = tx.outputs.find(output => 
      output.script_public_key_address === senderAddress && 
      output.amount >= expectedAmount * 0.95 // Allow 5% tolerance for fees
    )

    if (!outputToSelf) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Transaction must send 1.2 KAS to your own address' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract and parse chat message from payload (NO DECRYPTION - plain text only)
    console.log('[ChatVerify] Raw payload:', tx.payload);
    
    let parsedData = null
    if (tx.payload) {
      try {
        parsedData = parseChatMessage(tx.payload);
        console.log('[ChatVerify] Parsed data:', parsedData);
      } catch (error) {
        console.error('[ChatVerify] Error parsing payload:', error);
      }
    } else {
      console.error('[ChatVerify] No payload in transaction');
    }

    if (!parsedData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to parse message payload - check logs for details' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify stream ID matches
    if (parsedData.streamId !== streamId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Stream ID mismatch in payload' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log message verification
    console.log('[ChatVerify] Verified message:', {
      identifier: parsedData.identifier,
      version: parsedData.version,
      broadcast: parsedData.broadcast,
      streamId: parsedData.streamId
    })

    // Get user profile for avatar
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('handle, display_name, avatar_url')
      .eq('id', session.encrypted_user_id)
      .single()

    // Store message in database (timestamp is now() on server side)
    // Use displayMessage if provided (has emojis), otherwise use on-chain message
    const messageToStore = displayMessage || parsedData.messageContent;
    
    const { data: newMessage, error: insertError } = await supabaseClient
      .from('chat_messages')
      .insert({
        stream_id: streamId,
        user_id: session.encrypted_user_id,
        message: messageToStore,
        txid: cleanTxid
        // created_at defaults to now() on server
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting message:', insertError)
      throw new Error('Failed to store message')
    }

    console.log('Chat message verified and stored:', newMessage)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: {
          id: newMessage.id,
          user: {
            id: session.encrypted_user_id,
            name: profile?.display_name || profile?.handle || 'Anonymous',
            avatar: profile?.avatar_url
          },
          text: messageToStore, // Return the message with emojis
          timestamp: new Date(newMessage.created_at).getTime()
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error verifying chat message:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})