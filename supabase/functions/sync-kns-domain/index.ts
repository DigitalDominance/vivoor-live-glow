import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KnsApiResponse {
  success: boolean;
  data?: {
    ownerAddress: string;
    inscriptionId: string;
    domain: {
      name: string;
      tld: string;
      fullName: string;
      isVerified: boolean;
      status: string;
    };
  };
  message?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionToken, walletAddress } = await req.json();

    if (!sessionToken || !walletAddress) {
      throw new Error('sessionToken and walletAddress are required');
    }

    console.log(`Syncing KNS domain for wallet ${walletAddress}`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate session token and get user ID
    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from('wallet_auth_sessions')
      .select('encrypted_user_id')
      .eq('session_token', sessionToken)
      .eq('wallet_address', walletAddress)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !sessionData) {
      console.error('Invalid session:', sessionError);
      throw new Error('Invalid or expired session');
    }

    const userId = sessionData.encrypted_user_id;
    console.log(`Validated session for user ${userId}`);

    // Fetch primary name from KNS API
    const knsApiUrl = `https://api.knsdomains.org/mainnet/api/v1/primary-name/${encodeURIComponent(walletAddress)}`;
    const knsResponse = await fetch(knsApiUrl);
    const knsData: KnsApiResponse = await knsResponse.json();

    if (!knsData.success || !knsData.data) {
      // No KNS domain found - delete any existing record
      console.log(`No KNS domain found for ${walletAddress}, removing any existing records`);
      await supabaseAdmin
        .from('kns_domains')
        .delete()
        .eq('user_id', userId);

      return new Response(
        JSON.stringify({ success: true, knsDomain: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership matches
    if (knsData.data.ownerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      console.log(`Ownership mismatch for ${walletAddress}`);
      await supabaseAdmin
        .from('kns_domains')
        .delete()
        .eq('user_id', userId);

      return new Response(
        JSON.stringify({ success: true, knsDomain: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert KNS domain data
    const { error: upsertError } = await supabaseAdmin
      .from('kns_domains')
      .upsert({
        user_id: userId,
        owner_address: knsData.data.ownerAddress,
        inscription_id: knsData.data.inscriptionId,
        domain_name: knsData.data.domain.name,
        tld: knsData.data.domain.tld,
        full_name: knsData.data.domain.fullName,
        is_verified: knsData.data.domain.isVerified,
        status: knsData.data.domain.status,
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      throw upsertError;
    }

    console.log(`Successfully synced KNS domain ${knsData.data.domain.fullName} for user ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        knsDomain: knsData.data.domain.fullName 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing KNS domain:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
