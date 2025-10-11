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
    console.log('Starting KNS domain verification job...');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all KNS domains that need verification
    const { data: knsRecords, error: fetchError } = await supabaseAdmin
      .from('kns_domains')
      .select('id, user_id, owner_address, full_name')
      .order('last_verified_at', { ascending: true }); // Check oldest first

    if (fetchError) {
      console.error('Error fetching KNS records:', fetchError);
      throw fetchError;
    }

    if (!knsRecords || knsRecords.length === 0) {
      console.log('No KNS domains to verify');
      return new Response(
        JSON.stringify({ success: true, message: 'No domains to verify', verified: 0, disabled: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verifying ${knsRecords.length} KNS domains...`);

    let verifiedCount = 0;
    let disabledCount = 0;

    // Process each KNS record
    for (const record of knsRecords) {
      try {
        // Fetch current ownership from KNS API
        const knsApiUrl = `https://api.knsdomains.org/mainnet/api/v1/primary-name/${encodeURIComponent(record.owner_address)}`;
        const knsResponse = await fetch(knsApiUrl);
        const knsData: KnsApiResponse = await knsResponse.json();

        // Check if ownership still matches
        if (!knsData.success || !knsData.data || 
            knsData.data.ownerAddress.toLowerCase() !== record.owner_address.toLowerCase()) {
          
          // Ownership changed or domain lost - disable badge and delete record
          console.log(`Domain ${record.full_name} ownership changed for user ${record.user_id}`);
          
          // Disable badge in profile
          await supabaseAdmin
            .from('profiles')
            .update({ show_kns_badge: false })
            .eq('id', record.user_id);

          // Delete KNS record
          await supabaseAdmin
            .from('kns_domains')
            .delete()
            .eq('id', record.id);

          disabledCount++;
        } else {
          // Ownership still valid - update verification timestamp
          await supabaseAdmin
            .from('kns_domains')
            .update({ 
              last_verified_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', record.id);

          verifiedCount++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error verifying domain for user ${record.user_id}:`, error);
        // Continue with next record on error
      }
    }

    console.log(`Verification complete. Verified: ${verifiedCount}, Disabled: ${disabledCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        verified: verifiedCount,
        disabled: disabledCount,
        total: knsRecords.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in KNS verification job:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
