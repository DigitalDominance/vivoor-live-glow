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
}

interface KaspaTx {
  transaction_id: string;
  accepting_block_blue_score: number;
  block_time: number;
  payload?: string;
  inputs: Array<{
    signature_script?: string | null;
  }>;
  outputs: Array<{
    amount: number;
    script_public_key_address?: string | null;
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

    const { txid, streamId, expectedAmount, recipientAddress, senderAddress }: TipVerificationRequest = await req.json()

    console.log('Verifying tip transaction:', { txid, streamId, expectedAmount, recipientAddress })

    // Validate txid format
    if (!txid || typeof txid !== 'string' || txid.length < 10) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid transaction ID format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if we've already processed this transaction
    const { data: existingTip } = await supabaseClient
      .from('tips')
      .select('id')
      .eq('txid', txid)
      .single()

    if (existingTip) {
      return new Response(
        JSON.stringify({ success: false, error: 'Transaction already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch transaction from Kaspa API
    console.log('Fetching transaction from Kaspa API:', txid)
    const kaspaResponse = await fetch(`https://api.kaspa.org/transactions/${txid}`)
    
    if (!kaspaResponse.ok) {
      console.error('Kaspa API error:', kaspaResponse.status, await kaspaResponse.text())
      throw new Error(`Failed to fetch transaction: ${kaspaResponse.status}`)
    }

    const tx: KaspaTx = await kaspaResponse.json()

    // Verify transaction has output to recipient address
    const outputToRecipient = tx.outputs.find(output => 
      output.script_public_key_address === recipientAddress
    )

    if (!outputToRecipient) {
      return new Response(
        JSON.stringify({ success: false, error: 'Transaction does not send to recipient address' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify amount (allow some tolerance for fees)
    if (outputToRecipient.amount < expectedAmount * 0.95) { // 5% tolerance
      return new Response(
        JSON.stringify({ success: false, error: 'Transaction amount is too low' }),
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

    // Store verified tip in database
    const { data: newTip, error: insertError } = await supabaseClient
      .from('tips')
      .insert({
        stream_id: streamId,
        sender_address: senderAddress || 'unknown',
        recipient_address: recipientAddress,
        amount_sompi: outputToRecipient.amount,
        txid: txid,
        encrypted_message: encryptedMessage,
        decrypted_message: decryptedMessage,
        block_time: tx.accepting_block_blue_score,
        processed_at: new Date().toISOString()
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
          txid: txid,
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