import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TipVerificationRequest {
  txid: string;
  streamId: string;
  expectedAmount: number; // in sompi
  recipientAddress: string;
  senderAddress?: string;
  senderName?: string;
  senderAvatar?: string;
  tipMessage?: string;
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
      script_public_key: string;
      block_daa_score: string;
      is_coinbase: boolean;
    };
  }>;
  outputs: Array<{
    transaction_id: string;
    index: number;
    amount: number;
    script_public_key: string;
    script_public_key_address: string;
    script_public_key_type: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
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
      expectedAmount, 
      recipientAddress, 
      senderAddress,
      senderName,
      senderAvatar,
      tipMessage
    }: TipVerificationRequest = await req.json()

    console.log('Verifying tip transaction:', { 
      txid: typeof txid === 'string' ? txid : 'INVALID_TYPE',
      streamId, 
      expectedAmount, 
      recipientAddress 
    })

    // Validate txid format - ensure it's a string and proper length
    if (!txid || typeof txid !== 'string') {
      console.error('Invalid txid type:', typeof txid, txid)
      return new Response(
        JSON.stringify({ success: false, error: 'Transaction ID must be a string' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Clean the txid - remove any whitespace and validate hex format
    const cleanTxid = txid.trim()
    if (!/^[a-f0-9]{64}$/i.test(cleanTxid)) {
      console.error('Invalid txid format:', cleanTxid, 'Length:', cleanTxid.length)
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid transaction ID format - must be 64 character hex string' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if we've already processed this transaction
    const { data: existingTip } = await supabaseClient
      .from('tips')
      .select('id')
      .eq('txid', cleanTxid)
      .single()

    if (existingTip) {
      return new Response(
        JSON.stringify({ success: false, error: 'Transaction already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch transaction from Kaspa API with progressive retry logic
    const maxRetries = 10 // Increased from 5 to 10
    let tx: KaspaTx | null = null
    
    // Give the transaction more time to propagate to the API (initial 8 second delay)
    console.log('Waiting 8 seconds for transaction to propagate to Kaspa API...')
    await new Promise(resolve => setTimeout(resolve, 8000))
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const retryDelay = Math.min(attempt * 3000, 15000) // Progressive delay: 3s, 6s, 9s, 12s, 15s (cap at 15s)
      try {
        console.log(`Fetching transaction from Kaspa API (attempt ${attempt}/${maxRetries}):`, cleanTxid)
        const kaspaResponse = await fetch(`https://api.kaspa.org/transactions/${cleanTxid}?inputs=true&outputs=true&resolve_previous_outpoints=no`)
        
        if (!kaspaResponse.ok) {
          const errorText = await kaspaResponse.text()
          console.error(`Kaspa API error (attempt ${attempt}):`, kaspaResponse.status, errorText)
          
          if (attempt === maxRetries) {
            throw new Error(`Failed to fetch transaction after ${maxRetries} attempts: ${kaspaResponse.status}`)
          } else {
          await new Promise(resolve => setTimeout(resolve, retryDelay))
            continue
          }
        }

        tx = await kaspaResponse.json()
        console.log('Successfully fetched transaction data')
        break // Success, exit retry loop
        
      } catch (error) {
        console.error(`Error on attempt ${attempt}:`, error)
        if (attempt === maxRetries) {
          throw error
        } else {
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
      }
    }

    if (!tx) {
      throw new Error('Failed to fetch transaction data')
    }

    // Verify transaction is accepted
    if (!tx.is_accepted) {
      return new Response(
        JSON.stringify({ success: false, error: 'Transaction not yet accepted by the network' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify transaction has output to recipient address with correct amount
    const outputToRecipient = tx.outputs.find(output => 
      output.script_public_key_address === recipientAddress && output.amount >= expectedAmount
    )

    if (!outputToRecipient) {
      return new Response(
        JSON.stringify({ success: false, error: 'Transaction does not send the expected amount to recipient address' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract tip payload from transaction
    let encryptedMessage = '';
    let decryptedMessage = '';

    if (tx.payload) {
      // Convert hex payload to string to look for tip prefix
      try {
        const bytes: number[] = [];
        for (let i = 0; i < tx.payload.length; i += 2) {
          const byte = parseInt(tx.payload.slice(i, i + 2), 16);
          if (!Number.isNaN(byte)) bytes.push(byte);
        }
        const payloadText = new TextDecoder().decode(new Uint8Array(bytes));
        
        if (payloadText.includes('VIVR-TIP1:')) {
          const idx = payloadText.indexOf('VIVR-TIP1:');
          encryptedMessage = payloadText.slice(idx);
          
          // Try to decrypt the message (we'll need to import the crypto functions)
          // For now, just store the encrypted version
          decryptedMessage = encryptedMessage; // Placeholder - implement decryption
        }
      } catch (error) {
        console.error('Error parsing payload:', error);
      }
    }

    // Store verified tip in database with full sender address
    const { data: newTip, error: insertError } = await supabaseClient
      .from('tips')
      .insert({
        stream_id: streamId,
        sender_address: tx.inputs[0]?.utxo?.address || senderAddress || 'unknown', // Use actual sender from transaction inputs
        recipient_address: recipientAddress,
        amount_sompi: outputToRecipient.amount,
        txid: cleanTxid,
        encrypted_message: encryptedMessage,
        decrypted_message: decryptedMessage,
        block_time: tx.accepting_block_blue_score,
        processed_at: new Date().toISOString(),
        sender_name: senderName || 'Anonymous',
        sender_avatar: senderAvatar,
        tip_message: tipMessage || 'Thanks for the stream!'
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting tip:', insertError)
      throw new Error('Failed to store tip')
    }

    console.log('Tip verified and stored:', newTip)

    return new Response(
      JSON.stringify({ 
        success: true, 
        tip: {
          id: newTip.id,
          amount: Math.round(outputToRecipient.amount / 100000000), // Convert to KAS
          txid: cleanTxid,
          message: decryptedMessage
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error verifying tip:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})