import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KRC721HoldingResponse {
  message: string;
  result?: Array<{
    tick: string;
    tokenId: string;
    opScoreMod: string;
  }>;
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

    console.log(`🔍 Syncing KASPERS NFT for wallet ${walletAddress}`);

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
      console.error('❌ Invalid session:', sessionError);
      throw new Error('Invalid or expired session');
    }

    const userId = sessionData.encrypted_user_id;
    console.log(`✅ Validated session for user ${userId}`);

    // Fetch KASPERS NFT holdings from KRC721 API
    const apiUrl = `https://mainnet.krc721.stream/api/v1/krc721/mainnet/address/${walletAddress}/KASPERS`;
    console.log(`📡 Fetching from: ${apiUrl}`);
    
    const apiResponse = await fetch(apiUrl);
    
    if (!apiResponse.ok) {
      console.error(`❌ KRC721 API error: ${apiResponse.status}`);
      throw new Error(`KRC721 API error: ${apiResponse.status}`);
    }

    const holdingData: KRC721HoldingResponse = await apiResponse.json();
    console.log('📦 API Response:', JSON.stringify(holdingData, null, 2));

    // Check if wallet owns KASPERS NFT
    const hasNFT = holdingData.result && 
                   Array.isArray(holdingData.result) && 
                   holdingData.result.length > 0 && 
                   holdingData.result[0]?.tokenId;

    if (!hasNFT) {
      // No KASPERS NFT found - disable badge and remove records
      console.log(`❌ No KASPERS NFT found for ${walletAddress}, removing records`);
      
      await supabaseAdmin
        .from('profiles')
        .update({ show_kaspers_badge: false })
        .eq('id', userId);

      await supabaseAdmin
        .from('kaspers_nft_badges')
        .delete()
        .eq('user_id', userId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          hasNFT: false,
          message: 'No KASPERS NFT found'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenId = holdingData.result[0].tokenId;
    console.log(`✅ Found KASPERS NFT #${tokenId}`);

    // Check if this is first time claiming
    const { data: existingBadge } = await supabaseAdmin
      .from('kaspers_nft_badges')
      .select('*')
      .eq('user_id', userId)
      .single();

    const isFirstClaim = !existingBadge;
    const shouldGrantBonus = isFirstClaim || !existingBadge?.verification_bonus_granted;

    // Upsert badge record
    const { error: upsertError } = await supabaseAdmin
      .from('kaspers_nft_badges')
      .upsert({
        user_id: userId,
        tick: 'KASPERS',
        token_id: tokenId,
        owner_address: walletAddress,
        is_verified: true,
        last_verified_at: new Date().toISOString(),
        verification_bonus_granted: shouldGrantBonus ? true : existingBadge?.verification_bonus_granted,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,tick'
      });

    if (upsertError) {
      throw upsertError;
    }

    // Enable badge in profile
    await supabaseAdmin
      .from('profiles')
      .update({ 
        show_kaspers_badge: true,
        kaspers_last_verified_at: new Date().toISOString()
      })
      .eq('id', userId);

    // Grant 6 month verification bonus if first claim
    if (shouldGrantBonus) {
      console.log('🎉 First KASPERS NFT claim - granting 6 month verification bonus');

      // Get current verification if exists
      const { data: currentVerification } = await supabaseAdmin
        .from('verifications')
        .select('expires_at')
        .eq('user_id', userId)
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Calculate new expiry (6 months from now or 6 months added to existing)
      const baseDate = currentVerification && new Date(currentVerification.expires_at) > new Date()
        ? new Date(currentVerification.expires_at)
        : new Date();
      
      const newExpiry = new Date(baseDate);
      newExpiry.setMonth(newExpiry.getMonth() + 6);

      // Insert verification bonus
      await supabaseAdmin
        .from('verifications')
        .insert({
          user_id: userId,
          txid: `kaspers_nft_bonus_${Date.now()}`,
          amount_sompi: 60000000000, // 600 KAS in sompi
          duration_type: 'kaspers_nft_bonus',
          block_time: Math.floor(Date.now() / 1000),
          verified_at: new Date().toISOString(),
          expires_at: newExpiry.toISOString()
        });

      console.log('✅ Verification bonus granted successfully');
    }

    console.log(`✅ Successfully synced KASPERS NFT #${tokenId} for user ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        hasNFT: true,
        tokenId,
        firstClaim: isFirstClaim,
        bonusGranted: shouldGrantBonus
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error syncing KASPERS NFT:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
