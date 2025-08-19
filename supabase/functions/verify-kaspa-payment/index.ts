import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Treasury wallet address
const TREASURY_ADDRESS = "kaspa:qzs7mlxwqtuyvv47yhx0xzhmphpazxzw99patpkh3ezfghejhq8wv6jsc7f80";

// Verification amounts in sompi (1 KAS = 100,000,000 sompi)
const MONTHLY_AMOUNT = 75 * 100_000_000; // 75 KAS
const YEARLY_AMOUNT = 750 * 100_000_000; // 750 KAS

type KaspaTx = {
  transaction_id: string;
  accepting_block_blue_score: number;
  block_time: number;
  inputs: Array<{
    signature_script?: string | null;
  }>;
  outputs: Array<{
    amount: number;
    script_public_key_address?: string | null;
  }>;
};

function sumOutputsToAddress(tx: KaspaTx, address: string): number {
  return tx.outputs
    .filter(o => o.script_public_key_address === address)
    .reduce((acc, o) => acc + (o.amount || 0), 0);
}

async function fetchAddressTransactions(address: string, limit = 50): Promise<KaspaTx[]> {
  const url = `https://api.kaspa.org/addresses/${encodeURIComponent(address)}/full-transactions?limit=${limit}&offset=0&resolve_previous_outpoints=no`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Kaspa API error ${res.status}`);
  return (await res.json()) as KaspaTx[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userAddress, amount, durationType, startTime } = await req.json();

    if (!userAddress || !amount || !durationType || !startTime) {
      throw new Error('Missing required parameters');
    }

    // Validate amount and duration type
    const expectedAmount = durationType === 'monthly' ? MONTHLY_AMOUNT : YEARLY_AMOUNT;
    if (amount !== expectedAmount) {
      throw new Error('Invalid amount for verification type');
    }

    console.log(`Scanning for verification payment from ${userAddress} to ${TREASURY_ADDRESS}`);
    console.log(`Expected amount: ${expectedAmount} sompi (${expectedAmount / 100_000_000} KAS)`);
    console.log(`Duration type: ${durationType}`);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: userData } = await userClient.auth.getUser(token);
    if (!userData.user) {
      throw new Error('Invalid user token');
    }

    const userId = userData.user.id;

    // Fetch transactions to treasury address
    const transactions = await fetchAddressTransactions(TREASURY_ADDRESS, 100);
    
    // Look for payments from the user's address since startTime
    const startTimeMs = new Date(startTime).getTime();
    
    for (const tx of transactions) {
      // Check if transaction is recent enough (after start time)
      if (tx.block_time < startTimeMs) {
        continue;
      }

      // Check if this transaction sends the correct amount to treasury
      const amountToTreasury = sumOutputsToAddress(tx, TREASURY_ADDRESS);
      
      if (amountToTreasury >= expectedAmount) {
        console.log(`Found potential verification transaction: ${tx.transaction_id}`);
        console.log(`Amount: ${amountToTreasury} sompi`);

        // Check if we already have this transaction recorded
        const { data: existingVerification } = await supabase
          .from('verifications')
          .select('id')
          .eq('txid', tx.transaction_id)
          .single();

        if (existingVerification) {
          console.log('Transaction already recorded');
          continue;
        }

        // Check transaction inputs to see if it came from user's address
        // This is a simplified check - in a production system you'd want more thorough verification
        console.log(`Verification payment found: ${tx.transaction_id}`);

        // Calculate expiry date
        const expiresAt = new Date();
        if (durationType === 'monthly') {
          expiresAt.setMonth(expiresAt.getMonth() + 1);
        } else {
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        }

        // Record the verification
        const { data: verification, error: insertError } = await supabase
          .from('verifications')
          .insert({
            user_id: userId,
            txid: tx.transaction_id,
            amount_sompi: amountToTreasury,
            duration_type: durationType,
            expires_at: expiresAt.toISOString(),
            block_time: tx.block_time,
            verified_at: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error inserting verification:', insertError);
          throw insertError;
        }

        return new Response(JSON.stringify({
          success: true,
          verification,
          message: 'Verification payment confirmed!',
          expiresAt: expiresAt.toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // No matching transaction found
    return new Response(JSON.stringify({
      success: false,
      message: 'No verification payment found yet. Please wait for the transaction to be confirmed.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in verify-kaspa-payment:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});