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

const TREASURY_ADDRESS = 'kaspa:qzs7mlxwqtuyvv47yhx0xzhmphpazxzw99patpkh3ezfghejhq8wv6jsc7f80';
const KASPA_API_BASE = 'https://api.kaspa.org';

const PAYMENT_AMOUNTS: Record<string, { sompi: number; kas: number }> = {
  stream_start: { sompi: 120000000, kas: 1.2 },
  monthly_verification: { sompi: 10000000000, kas: 100 },
  yearly_verification: { sompi: 100000000000, kas: 1000 }
};

async function fetchKaspaTransaction(txid: string, maxRetries = 5): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Fetching transaction from Kaspa API (attempt ${attempt}/${maxRetries}): ${txid}`);
      
      const response = await fetch(`https://api.kaspa.org/transactions/${txid}?inputs=true&outputs=true&resolve_previous_outpoints=no`, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        if (response.status === 404 && attempt < maxRetries) {
          console.log(`Transaction not found on attempt ${attempt}, retrying in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        const errorText = await response.text();
        console.error(`Kaspa API error (attempt ${attempt}):`, response.status, errorText);
        throw new Error(`Kaspa API error: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Successfully fetched transaction data');
      return data;
    } catch (error) {
      console.error(`Kaspa API error (attempt ${attempt}):`, error);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

function sumOutputsToAddress(transaction: any, address: string): number {
  if (!transaction.outputs) return 0;
  
  return transaction.outputs
    .filter((output: any) => output.script_public_key_address === address)
    .reduce((sum: number, output: any) => sum + (output.amount || 0), 0);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userAddress, paymentType, txid, startTime }: PaymentRequest = await req.json();
    
    console.log('RAW REQUEST DATA:', JSON.stringify({ userAddress, paymentType, txid: typeof txid, startTime }));
    console.log('TXID TYPE:', typeof txid);
    console.log('TXID LENGTH:', typeof txid === 'string' ? txid.length : 'NOT STRING');
    console.log('TXID SAMPLE:', typeof txid === 'string' ? txid.slice(0, 100) : txid);

    // Validate payment type and amount
    const expectedPayment = PAYMENT_AMOUNTS[paymentType];
    if (!expectedPayment) {
      console.log('INVALID PAYMENT TYPE:', paymentType);
      return new Response(
        JSON.stringify({ error: 'Invalid payment type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('EXPECTED PAYMENT:', expectedPayment);

    // Extract transaction ID if txid is passed as a JSON object
    let cleanTxid: string;
    if (typeof txid === 'string') {
      try {
        // Try to parse as JSON first (in case it's the full transaction object)
        const parsed = JSON.parse(txid);
        console.log('PARSED TXID AS JSON:', typeof parsed, Object.keys(parsed || {}));
        if (parsed.id) {
          cleanTxid = parsed.id;
          console.log('USING PARSED ID:', cleanTxid);
        } else if (parsed.transaction_id) {
          cleanTxid = parsed.transaction_id;
          console.log('USING PARSED TRANSACTION_ID:', cleanTxid);
        } else {
          cleanTxid = txid.trim();
          console.log('USING TRIMMED ORIGINAL:', cleanTxid);
        }
      } catch (e) {
        // Not JSON, treat as plain txid
        cleanTxid = txid.trim();
        console.log('NOT JSON, USING TRIMMED:', cleanTxid);
      }
    } else {
      console.log('TXID NOT STRING, TYPE:', typeof txid);
      return new Response(
        JSON.stringify({ error: 'Transaction ID must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('CLEAN TXID:', cleanTxid);
    console.log('CLEAN TXID LENGTH:', cleanTxid.length);
    console.log('HEX REGEX TEST:', /^[a-f0-9]{64}$/i.test(cleanTxid));

    // Validate txid format
    if (!/^[a-f0-9]{64}$/i.test(cleanTxid)) {
      console.error('INVALID TXID FORMAT - Expected 64 char hex, got:', cleanTxid, 'Length:', cleanTxid.length);
      return new Response(
        JSON.stringify({ error: `Invalid transaction ID format - must be 64 character hex string. Got ${cleanTxid.length} characters.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if transaction already verified
    const { data: existingVerification } = await supabase
      .from('payment_verifications')
      .select('id')
      .eq('txid', cleanTxid)
      .single();

    if (existingVerification) {
      return new Response(
        JSON.stringify({ error: 'Transaction already verified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch and verify transaction from Kaspa network
    const transaction = await fetchKaspaTransaction(cleanTxid);
    
    // Verify transaction is accepted (if this field exists)
    if (transaction.is_accepted !== undefined && !transaction.is_accepted) {
      return new Response(
        JSON.stringify({ error: 'Transaction not yet accepted by the network' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check transaction timing - use accepting_block_blue_score or block_time
    const transactionTime = transaction.accepting_block_blue_score || transaction.block_time;
    if (transactionTime && transactionTime < startTime) {
      return new Response(
        JSON.stringify({ error: 'Transaction is too old' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify payment amount to treasury address
    const amountSent = sumOutputsToAddress(transaction, TREASURY_ADDRESS);
    if (amountSent < expectedPayment.sompi) {
      return new Response(
        JSON.stringify({ 
          error: `Insufficient payment. Expected ${expectedPayment.kas} KAS, received ${amountSent / 100000000} KAS` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify transaction came from the user's address
    const senderAddress = transaction.inputs?.[0]?.utxo?.address;
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

    // Store verification
    const { data: verification, error: dbError } = await supabase
      .from('payment_verifications')
      .insert({
        user_id: userAddress,
        payment_type: paymentType,
        amount_sompi: amountSent,
        amount_kas: amountSent / 100000000,
        txid: cleanTxid,
        block_time: transactionTime,
        treasury_address: TREASURY_ADDRESS,
        expires_at: expiresAt
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Failed to record verification' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Payment verified and stored:', verification);

    return new Response(
      JSON.stringify({ 
        success: true, 
        verification: {
          id: verification.id,
          payment_type: verification.payment_type,
          amount_kas: verification.amount_kas,
          expires_at: verification.expires_at
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Payment verification error:', error);
    return new Response(
      JSON.stringify({ error: 'Payment verification failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});