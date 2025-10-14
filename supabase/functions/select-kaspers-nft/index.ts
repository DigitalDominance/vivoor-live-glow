import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionToken, walletAddress, tokenId } = await req.json();

    if (!sessionToken || !walletAddress || !tokenId) {
      throw new Error('sessionToken, walletAddress, and tokenId are required');
    }

    console.log(`🔄 Changing selected KASPERS NFT to #${tokenId} for wallet ${walletAddress}`);

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

    // Verify the user owns this NFT
    const { data: nftData, error: nftError } = await supabaseAdmin
      .from('kaspers_nft_badges')
      .select('*')
      .eq('user_id', userId)
      .eq('tick', 'KASPERS')
      .eq('token_id', tokenId)
      .eq('is_verified', true)
      .single();

    if (nftError || !nftData) {
      console.error('❌ NFT not found or not verified:', nftError);
      throw new Error('You do not own this KASPERS NFT');
    }

    // Deselect all other NFTs for this user
    await supabaseAdmin
      .from('kaspers_nft_badges')
      .update({ is_selected: false })
      .eq('user_id', userId)
      .eq('tick', 'KASPERS');

    // Select the specified NFT
    const { error: updateError } = await supabaseAdmin
      .from('kaspers_nft_badges')
      .update({ is_selected: true, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('tick', 'KASPERS')
      .eq('token_id', tokenId);

    if (updateError) {
      throw updateError;
    }

    console.log(`✅ Successfully selected KASPERS NFT #${tokenId} for user ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        tokenId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error selecting KASPERS NFT:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});