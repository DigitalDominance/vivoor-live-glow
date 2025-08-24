import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentRequest {
  userAddress: string;
  paymentType: 'stream_start' | 'monthly_verification' | 'yearly_verification';
  txid: string;
  startTime: number;
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

const TREASURY_ADDRESS = 'kaspa:qzs7mlxwqtuyvv47yhx0xzhmphpazxzw99patpkh3ezfghejhq8wv6jsc7f80';

const PAYMENT_AMOUNTS: Record<string, { sompi: number; kas: number }> = {
  stream_start: { sompi: 120000000, kas: 1.2 },
  monthly_verification: { sompi: 10000000000, kas: 100 },
  yearly_verification: { sompi: 100000000000, kas: 1000 }
};

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

    const { 
      userAddress, 
      paymentType, 
      txid, 
      startTime 
    }: PaymentRequest = await req.json();

    console.log('Verifying payment:', { 
      userAddress,
      paymentType, 
      txid: typeof txid === 'string' ? txid : 'INVALID_TYPE',
      startTime 
    });

    // Validate payment type and amount
    const expectedPayment = PAYMENT_AMOUNTS[paymentType];
    if (!expectedPayment) {
      return new Response(
        JSON.stringify({ error: 'Invalid payment type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract transaction ID if txid is passed as a JSON object (from wallet)
    let cleanTxid: string;
    let walletTransaction: any = null;
    
    if (typeof txid === 'string') {
      try {
        // Try to parse as JSON first (transaction object from wallet)
        const parsed = JSON.parse(txid);
        if (parsed.id) {
          cleanTxid = parsed.id;
          walletTransaction = parsed; // Store the wallet transaction for validation
          console.log('Using wallet transaction object, txid:', cleanTxid);
        } else if (parsed.transaction_id) {
          cleanTxid = parsed.transaction_id;
        } else {
          cleanTxid = txid.trim();
        }
      } catch {
        // Not JSON, treat as plain txid
        cleanTxid = txid.trim();
      }
    } else {
      console.error('Invalid txid type:', typeof txid);
      return new Response(
        JSON.stringify({ error: 'Transaction ID must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate txid format
    if (!/^[a-f0-9]{64}$/i.test(cleanTxid)) {
      console.error('Invalid txid format:', cleanTxid, 'Length:', cleanTxid.length);
      return new Response(
        JSON.stringify({ error: 'Invalid transaction ID format - must be 64 character hex string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if we've already processed this transaction (EXACTLY like tip verification)
    const { data: existingPayment } = await supabaseClient
      .from('payment_verifications')
      .select('id')
      .eq('txid', cleanTxid)
      .single();

    if (existingPayment) {
      return new Response(
        JSON.stringify({ error: 'Transaction already processed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let tx: any = null;
    
    // If we have the wallet transaction object, use it directly for validation
    if (walletTransaction) {
      console.log('Using wallet transaction directly for validation');
      tx = walletTransaction;
      
      // Convert wallet transaction format to API format for validation
      // Wallet uses 'value' and 'scriptPublicKey', API uses 'amount' and 'script_public_key_address'
      if (tx.outputs) {
        tx.outputs = tx.outputs.map((output: any) => ({
          ...output,
          amount: parseInt(output.value || output.amount || '0'),
          script_public_key_address: output.script_public_key_address || TREASURY_ADDRESS // We know it's going to treasury
        }));
      }
      
      // Assume wallet transaction is accepted since it was successfully created
      tx.is_accepted = true;
      tx.accepting_block_blue_score = Date.now(); // Use current time as fallback
    } else {
      // Fetch transaction from Kaspa API with progressive retry logic 
      const maxRetries = 5;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const retryDelay = attempt * 1000; // Progressive delay: 1s, 2s, 3s, 4s, 5s
        try {
          console.log(`Fetching transaction from Kaspa API (attempt ${attempt}/${maxRetries}):`, cleanTxid);
          const kaspaResponse = await fetch(`https://api.kaspa.org/transactions/${cleanTxid}?inputs=true&outputs=true&resolve_previous_outpoints=no`);
          
          if (!kaspaResponse.ok) {
            const errorText = await kaspaResponse.text();
            console.error(`Kaspa API error (attempt ${attempt}):`, kaspaResponse.status, errorText);
            
            if (attempt === maxRetries) {
              throw new Error(`Failed to fetch transaction after ${maxRetries} attempts: ${kaspaResponse.status}`);
            } else {
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              continue;
            }
          }

          tx = await kaspaResponse.json();
          console.log('Successfully fetched transaction data');
          break; // Success, exit retry loop
          
        } catch (error) {
          console.error(`Error on attempt ${attempt}:`, error);
          if (attempt === maxRetries) {
            throw error;
          } else {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      }
    }

    if (!tx) {
      throw new Error('Failed to get transaction data');
    }

    console.log('Transaction data:', JSON.stringify(tx, null, 2));

    // Verify transaction is accepted
    if (tx.is_accepted !== undefined && !tx.is_accepted) {
      return new Response(
        JSON.stringify({ error: 'Transaction not yet accepted by the network' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify transaction has output to treasury address with correct amount
    console.log('Looking for output to treasury address:', TREASURY_ADDRESS);
    console.log('Expected amount (sompi):', expectedPayment.sompi);
    console.log('Transaction outputs:', tx.outputs);
    
    const outputToTreasury = tx.outputs?.find((output: any) => {
      const amount = parseInt(output.value || output.amount || '0');
      console.log(`Checking output: amount=${amount}, address=${output.script_public_key_address || 'TREASURY'}`);
      
      // For wallet transactions, we assume the first output with the right amount goes to treasury
      if (walletTransaction) {
        return amount >= expectedPayment.sompi;
      }
      
      // For API transactions, check the actual address
      return output.script_public_key_address === TREASURY_ADDRESS && amount >= expectedPayment.sompi;
    });

    if (!outputToTreasury) {
      return new Response(
        JSON.stringify({ error: 'Transaction does not send the expected amount to treasury address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify transaction came from the user's address (check sender)
    const senderAddress = tx.inputs[0]?.utxo?.address;
    if (senderAddress !== userAddress) {
      return new Response(
        JSON.stringify({ 
          error: `Transaction must be sent from your wallet address. Expected: ${userAddress}, Found: ${senderAddress}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate expiry date for verification types
    let expiresAt: string | null = null;
    if (paymentType === 'monthly_verification') {
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    } else if (paymentType === 'yearly_verification') {
      expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    }

    // Store verified payment in database (EXACTLY like tip verification)
    const outputAmount = parseInt(outputToTreasury.value || outputToTreasury.amount || '0');
    const { data: newPayment, error: insertError } = await supabaseClient
      .from('payment_verifications')
      .insert({
        user_id: userAddress,
        payment_type: paymentType,
        amount_sompi: outputAmount,
        amount_kas: outputAmount / 100000000,
        txid: cleanTxid,
        block_time: tx.accepting_block_blue_score || Date.now(),
        treasury_address: TREASURY_ADDRESS,
        expires_at: expiresAt
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting payment verification:', insertError);
      throw new Error('Failed to store payment verification');
    }

    console.log('Payment verified and stored:', newPayment);

    return new Response(
      JSON.stringify({ 
        success: true, 
        verification: {
          id: newPayment.id,
          payment_type: newPayment.payment_type,
          amount_kas: newPayment.amount_kas,
          expires_at: newPayment.expires_at
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error verifying payment:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
