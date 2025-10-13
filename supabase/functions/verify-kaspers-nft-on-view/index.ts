import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KRC721HoldingResponse {
  message: string;
  result?: {
    tick: string;
    tokenId: string;
    opScoreMod: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    console.log('Verifying KASPERS NFT for user:', userId);

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user profile
    console.log('Fetching profile for user:', userId);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('kaspa_address, show_kaspers_badge, kaspers_last_verified_at')
      .eq('id', userId)
      .single();

    console.log('Profile query result:', { profile, profileError });

    if (profileError || !profile) {
      console.error('Profile not found:', profileError);
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Profile found. Kaspa address:', profile.kaspa_address);
    console.log('Show badge setting:', profile.show_kaspers_badge);

    // Only verify if badge is enabled
    if (!profile.show_kaspers_badge) {
      return new Response(
        JSON.stringify({ success: true, needsVerification: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if we verified recently (10 minute cache)
    if (profile.kaspers_last_verified_at) {
      const lastVerified = new Date(profile.kaspers_last_verified_at);
      const now = new Date();
      const timeDiff = now.getTime() - lastVerified.getTime();
      const minutesDiff = timeDiff / (1000 * 60);

      if (minutesDiff < 10) {
        console.log('Using cached verification result (verified within last 10 minutes)');
        return new Response(
          JSON.stringify({ success: true, needsVerification: false, cached: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!profile.kaspa_address) {
      console.error('No Kaspa address found for user');
      return new Response(
        JSON.stringify({ error: 'No Kaspa address found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch KASPERS NFT holdings from KRC721 API
    const apiUrl = `https://mainnet.krc721.stream/api/v1/krc721/mainnet/address/${profile.kaspa_address}/KASPER`;
    console.log('Fetching KASPERS holdings from:', apiUrl);
    console.log('Using kaspa_address:', profile.kaspa_address);

    const apiResponse = await fetch(apiUrl);
    console.log('API response status:', apiResponse.status);
    
    if (!apiResponse.ok) {
      console.error('KRC721 API error:', apiResponse.status);
      const errorText = await apiResponse.text();
      console.error('API error response:', errorText);
      throw new Error(`KRC721 API error: ${apiResponse.status}`);
    }

    const holdingData: KRC721HoldingResponse = await apiResponse.json();
    console.log('KRC721 API full response:', JSON.stringify(holdingData, null, 2));
    console.log('Result object:', holdingData.result);
    console.log('Has tokenId?:', holdingData.result?.tokenId);
    console.log('Checking hasNFT condition...');

    const hasNFT = holdingData.result && holdingData.result.tokenId;
    console.log('hasNFT result:', hasNFT);

    if (!hasNFT) {
      console.log('User no longer owns KASPERS NFT, removing badge');
      
      // Disable badge and delete from kaspers_nft_badges table
      await supabase
        .from('profiles')
        .update({ 
          show_kaspers_badge: false,
          kaspers_last_verified_at: new Date().toISOString()
        })
        .eq('id', userId);

      await supabase
        .from('kaspers_nft_badges')
        .delete()
        .eq('user_id', userId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          hasNFT: false,
          badgeRemoved: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // User owns the NFT - check if this is first time claiming
    const { data: existingBadge } = await supabase
      .from('kaspers_nft_badges')
      .select('*')
      .eq('user_id', userId)
      .single();

    const isFirstClaim = !existingBadge;

    // Update or insert badge record
    await supabase
      .from('kaspers_nft_badges')
      .upsert({
        user_id: userId,
        tick: 'KASPER',
        token_id: holdingData.result!.tokenId,
        owner_address: profile.kaspa_address,
        is_verified: true,
        last_verified_at: new Date().toISOString(),
        verification_bonus_granted: isFirstClaim ? false : (existingBadge?.verification_bonus_granted || false),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,tick'
      });

    // Update profile verification timestamp
    await supabase
      .from('profiles')
      .update({ 
        kaspers_last_verified_at: new Date().toISOString()
      })
      .eq('id', userId);

    // If first claim and not granted bonus yet, add 6 months verification
    if (isFirstClaim || !existingBadge?.verification_bonus_granted) {
      console.log('First KASPERS NFT claim detected - granting 6 month verification bonus');

      // Get current verification if exists
      const { data: currentVerification } = await supabase
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

      // Insert verification bonus (600 KAS equivalent for 6 months)
      await supabase
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

      // Mark bonus as granted
      await supabase
        .from('kaspers_nft_badges')
        .update({ verification_bonus_granted: true })
        .eq('user_id', userId);

      console.log('6 month verification bonus granted successfully');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        hasNFT: true,
        tokenId: holdingData.result!.tokenId,
        firstClaim: isFirstClaim,
        bonusGranted: isFirstClaim || !existingBadge?.verification_bonus_granted
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-kaspers-nft-on-view:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
