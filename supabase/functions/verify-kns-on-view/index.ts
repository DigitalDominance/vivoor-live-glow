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
    const { userId } = await req.json();

    if (!userId) {
      throw new Error('userId is required');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user's profile and KNS data
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, kaspa_address, show_kns_badge, kns_last_verified_at')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found:', profileError);
      return new Response(
        JSON.stringify({ success: false, needsVerification: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if badge is enabled
    if (!profile.show_kns_badge) {
      return new Response(
        JSON.stringify({ success: true, needsVerification: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if verification is recent (within last 10 minutes)
    const now = new Date();
    const lastVerified = profile.kns_last_verified_at ? new Date(profile.kns_last_verified_at) : null;
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    if (lastVerified && lastVerified > tenMinutesAgo) {
      // Recently verified, no need to check again
      return new Response(
        JSON.stringify({ success: true, needsVerification: false, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Need to verify - fetch from KNS API
    if (!profile.kaspa_address) {
      console.log('No wallet address for user:', userId);
      return new Response(
        JSON.stringify({ success: false, needsVerification: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const knsApiUrl = `https://api.knsdomains.org/mainnet/api/v1/primary-name/${encodeURIComponent(profile.kaspa_address)}`;
    const knsResponse = await fetch(knsApiUrl);
    const knsData: KnsApiResponse = await knsResponse.json();

    // Check if ownership is valid
    if (!knsData.success || !knsData.data || 
        knsData.data.ownerAddress.toLowerCase() !== profile.kaspa_address.toLowerCase()) {
      
      // Ownership changed or domain lost - disable badge
      console.log(`Domain ownership changed for user ${userId}, disabling badge`);
      
      await supabaseAdmin
        .from('profiles')
        .update({ 
          show_kns_badge: false,
          kns_last_verified_at: now.toISOString()
        })
        .eq('id', userId);

      // Delete KNS record
      await supabaseAdmin
        .from('kns_domains')
        .delete()
        .eq('user_id', userId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          ownershipChanged: true,
          badgeDisabled: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ownership still valid - update timestamp and KNS data
    await supabaseAdmin
      .from('profiles')
      .update({ kns_last_verified_at: now.toISOString() })
      .eq('id', userId);

    await supabaseAdmin
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
        last_verified_at: now.toISOString(),
        updated_at: now.toISOString(),
      }, {
        onConflict: 'user_id'
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        verified: true,
        knsDomain: knsData.data.domain.fullName
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-kns-on-view:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
