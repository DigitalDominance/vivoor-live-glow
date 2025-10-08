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

// Decrypt chat message (same logic as frontend)
async function decryptChatMessage(encryptedPayload: string): Promise<{
  username: string;
  streamId: string;
  messageContent: string;
  timestamp: number;
} | null> {
  const CHAT_IDENTIFIER = "VIVR-CHAT1:";
  
  try {
    if (!encryptedPayload.startsWith(CHAT_IDENTIFIER)) {
      return null;
    }
    
    const hexData = encryptedPayload.slice(CHAT_IDENTIFIER.length);
    const bytes = new Uint8Array(
      hexData.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );
    
    if (bytes.length < 12) return null;
    
    const iv = bytes.slice(0, 12);
    const encrypted = bytes.slice(12);
    
    // Derive key
    const sharedSecret = "VIVOOR_CHAT_SECRET_2025";
    const encoder = new TextEncoder();
    const keyData = encoder.encode(sharedSecret);
    const hash = await crypto.subtle.digest('SHA-256', keyData);
    const key = await crypto.subtle.importKey(
      'raw',
      hash,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    const payloadString = decoder.decode(decrypted);
    
    // Parse: {username}:{streamID}:{messageContent}:{timestamp}
    const parts = payloadString.split(':');
    if (parts.length < 4) return null;
    
    const username = parts[0];
    const streamId = parts[1];
    const timestamp = parseInt(parts[parts.length - 1]);
    const messageContent = parts.slice(2, -1).join(':');
    
    return { username, streamId, messageContent, timestamp };
  } catch (error) {
    console.error('Decryption error:', error);
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
      walletAddress
    }: ChatVerificationRequest = await req.json()

    console.log('Verifying chat message transaction:', { txid, streamId, senderAddress })

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

    // Wait and fetch transaction with retries
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

        tx = await kaspaResponse.json()
        console.log('Transaction fetched successfully')
        break
        
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
        JSON.stringify({ success: false, error: 'Transaction not yet accepted' }),
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

    // Extract and decrypt chat message from payload
    let decryptedData = null
    if (tx.payload) {
      try {
        const bytes: number[] = [];
        for (let i = 0; i < tx.payload.length; i += 2) {
          const byte = parseInt(tx.payload.slice(i, i + 2), 16);
          if (!Number.isNaN(byte)) bytes.push(byte);
        }
        const payloadText = new TextDecoder().decode(new Uint8Array(bytes));
        
        if (payloadText.includes('VIVR-CHAT1:')) {
          const idx = payloadText.indexOf('VIVR-CHAT1:');
          const encryptedMessage = payloadText.slice(idx);
          decryptedData = await decryptChatMessage(encryptedMessage);
        }
      } catch (error) {
        console.error('Error parsing payload:', error);
      }
    }

    if (!decryptedData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to decrypt message payload' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify stream ID matches
    if (decryptedData.streamId !== streamId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Stream ID mismatch in payload' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user profile for avatar
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('handle, display_name, avatar_url')
      .eq('id', session.encrypted_user_id)
      .single()

    // Store message in database
    const { data: newMessage, error: insertError } = await supabaseClient
      .from('chat_messages')
      .insert({
        stream_id: streamId,
        user_id: session.encrypted_user_id,
        message: decryptedData.messageContent,
        txid: cleanTxid,
        created_at: new Date(decryptedData.timestamp).toISOString()
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
          text: decryptedData.messageContent,
          timestamp: decryptedData.timestamp
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