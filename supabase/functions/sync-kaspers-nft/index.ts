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

    // Check if wallet owns any KASPERS NFTs
    const hasNFTs = holdingData.result && 
                    Array.isArray(holdingData.result) && 
                    holdingData.result.length > 0;

    if (!hasNFTs) {
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

    console.log(`✅ Found ${holdingData.result.length} KASPERS NFT(s)`);
    
    // Get all token IDs
    const tokenIds = holdingData.result.map(nft => nft.tokenId);

    // Check if user has EVER received the KASPERS verification bonus
    const { data: allUserBadges } = await supabaseAdmin
      .from('kaspers_nft_badges')
      .select('verification_bonus_granted')
      .eq('user_id', userId);

    const hasEverClaimedBonus = allUserBadges && allUserBadges.length > 0 && 
                                 allUserBadges.some(b => b.verification_bonus_granted === true);
    
    // Get existing badges to see which ones user already has
    const { data: existingBadges } = await supabaseAdmin
      .from('kaspers_nft_badges')
      .select('*')
      .eq('user_id', userId)
      .eq('tick', 'KASPERS');

    const isFirstClaim = !existingBadges || existingBadges.length === 0;
    const shouldGrantBonus = !hasEverClaimedBonus; // Only grant once EVER per user

    // Determine which NFT should be selected
    const currentSelected = existingBadges?.find(b => b.is_selected);
    
    // Upsert all NFT badges
    for (const nft of holdingData.result) {
      const tokenId = nft.tokenId;
      const isSelected = currentSelected 
        ? currentSelected.token_id === tokenId  // Keep current selection
        : tokenId === tokenIds[0];  // First claim: select first NFT

      const { error: upsertError } = await supabaseAdmin
        .from('kaspers_nft_badges')
        .upsert({
          user_id: userId,
          tick: 'KASPERS',
          token_id: tokenId,
          owner_address: walletAddress,
          is_verified: true,
          is_selected: isSelected,
          last_verified_at: new Date().toISOString(),
          verification_bonus_granted: shouldGrantBonus && isSelected ? true : false,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,tick,token_id'
        });

      if (upsertError) {
        console.error(`❌ Failed to upsert NFT #${tokenId}:`, upsertError);
      } else {
        console.log(`✅ Synced KASPERS NFT #${tokenId} ${isSelected ? '(selected)' : ''}`);
      }
    }

    // Remove any NFTs the user no longer owns
    const { error: deleteError } = await supabaseAdmin
      .from('kaspers_nft_badges')
      .delete()
      .eq('user_id', userId)
      .eq('tick', 'KASPERS')
      .not('token_id', 'in', `(${tokenIds.join(',')})`);

    if (deleteError) {
      console.error('❌ Failed to remove old NFTs:', deleteError);
    }

    // Enable badge in profile
    await supabaseAdmin
      .from('profiles')
      .update({ 
        show_kaspers_badge: true,
        kaspers_last_verified_at: new Date().toISOString()
      })
      .eq('id', userId);

    // Grant 6 month verification bonus if never claimed before
    if (shouldGrantBonus) {
      console.log('🎉 First time EVER claiming KASPERS bonus - granting 6 month verification');

      // Calculate expiry 6 months from now
      const newExpiry = new Date();
      newExpiry.setMonth(newExpiry.getMonth() + 6);

      // Insert verification bonus using valid duration_type
      const { error: verificationError } = await supabaseAdmin
        .from('verifications')
        .insert({
          user_id: userId,
          txid: `kaspers_nft_bonus_${Date.now()}`,
          amount_sompi: 60000000000, // 600 KAS in sompi
          duration_type: 'monthly_verification', // Use valid duration type
          block_time: Math.floor(Date.now() / 1000),
          verified_at: new Date().toISOString(),
          expires_at: newExpiry.toISOString()
        });

      if (verificationError) {
        console.error('❌ Failed to grant verification bonus:', verificationError);
      } else {
        console.log('✅ 6 month verification bonus granted successfully');
      }
    } else {
      console.log('ℹ️ User has already claimed KASPERS verification bonus previously');
    }

    console.log(`✅ Successfully synced ${tokenIds.length} KASPERS NFT(s) for user ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        hasNFT: true,
        tokenIds,
        selectedTokenId: currentSelected?.token_id || tokenIds[0],
        count: tokenIds.length,
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
