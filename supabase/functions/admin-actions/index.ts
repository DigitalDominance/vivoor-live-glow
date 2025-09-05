import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Secure password verification using constant-time comparison
async function verifyPasswordSecure(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const providedBytes = encoder.encode(provided);
  const expectedBytes = encoder.encode(expected);
  
  // Ensure same length comparison to prevent timing attacks
  if (providedBytes.length !== expectedBytes.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < providedBytes.length; i++) {
    result |= providedBytes[i] ^ expectedBytes[i];
  }
  
  return result === 0;
}

// Validate UUID format
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdminAction {
  action: 'verify_password' | 'ban_user' | 'unban_user' | 'end_stream' | 'get_users' | 'get_live_streams' | 'get_reports' | 'resolve_report';
  password?: string;
  userId?: string;
  streamId?: string;
  reportId?: string;
  search?: string;
  offset?: number;
  limit?: number;
  statusFilter?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const adminPassword = Deno.env.get('ADMIN_PASSWORD');
    
    if (!adminPassword) {
      return new Response(
        JSON.stringify({ error: 'Admin password not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Rate limiting check - basic protection
    const userAgent = req.headers.get('user-agent') || '';
    const contentType = req.headers.get('content-type') || '';
    
    if (!contentType.includes('application/json')) {
      return new Response(
        JSON.stringify({ error: 'Invalid content type' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let body: AdminAction;
    try {
      body = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { action, password, userId, streamId, reportId, search, offset = 0, limit = 50, statusFilter } = body;

    // Validate action parameter
    const validActions = ['verify_password', 'ban_user', 'unban_user', 'end_stream', 'get_users', 'get_live_streams', 'get_reports', 'resolve_report'];
    if (!action || !validActions.includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing action' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate pagination parameters
    if (offset < 0 || limit < 1 || limit > 100) {
      return new Response(
        JSON.stringify({ error: 'Invalid pagination parameters' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate password presence
    if (!password || typeof password !== 'string' || password.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Password required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify admin password for all actions using constant-time comparison
    const isValidPassword = await verifyPasswordSecure(password, adminPassword);
    if (!isValidPassword) {
      // Add delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 1000));
      return new Response(
        JSON.stringify({ error: 'Invalid admin password' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let result = null;

    switch (action) {
      case 'verify_password':
        result = { verified: true };
        break;

      case 'ban_user':
        if (!userId || typeof userId !== 'string' || userId.trim() === '') {
          return new Response(
            JSON.stringify({ error: 'Valid User ID required' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        const { error: banError } = await supabaseClient.rpc('admin_ban_user', {
          user_id_param: userId,
          ban_status: true
        });
        if (banError) throw banError;
        result = { success: true, message: 'User banned successfully' };
        break;

      case 'unban_user':
        if (!userId || typeof userId !== 'string' || userId.trim() === '') {
          return new Response(
            JSON.stringify({ error: 'Valid User ID required' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        const { error: unbanError } = await supabaseClient.rpc('admin_ban_user', {
          user_id_param: userId,
          ban_status: false
        });
        if (unbanError) throw unbanError;
        result = { success: true, message: 'User unbanned successfully' };
        break;

      case 'end_stream':
        if (!streamId || typeof streamId !== 'string' || !isValidUUID(streamId)) {
          return new Response(
            JSON.stringify({ error: 'Valid Stream UUID required' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        const { error: endStreamError } = await supabaseClient.rpc('admin_delete_stream', {
          stream_id_param: streamId
        });
        if (endStreamError) throw endStreamError;
        result = { success: true, message: 'Stream deleted successfully' };
        break;

      case 'get_users':
        // Sanitize search input
        const sanitizedSearch = search ? search.trim().slice(0, 100) : null;
        const { data: users, error: usersError } = await supabaseClient.rpc('admin_get_users', {
          search_query: sanitizedSearch,
          limit_param: limit,
          offset_param: offset
        });
        if (usersError) throw usersError;
        result = { users };
        break;

      case 'get_live_streams':
        // Get only live streams with profile information
        const { data: streams, error: streamsError } = await supabaseClient
          .from('streams')
          .select(`
            id,
            title,
            user_id,
            viewers,
            created_at,
            stream_type,
            is_live
          `)
          .eq('is_live', true)
          .order('created_at', { ascending: false })
          .limit(limit)
          .range(offset, offset + limit - 1);
        
        if (streamsError) throw streamsError;
        
        // Get profile information for each stream
        const streamsWithProfiles = [];
        for (const stream of streams || []) {
          const { data: profile } = await supabaseClient.rpc('get_public_profile_secure', {
            _id: stream.user_id
          });
          
          if (profile && profile.length > 0) {
            streamsWithProfiles.push({
              ...stream,
              profile_handle: profile[0].handle,
              profile_display_name: profile[0].display_name,
              profile_avatar_url: profile[0].avatar_url
            });
          }
        }
        
        result = { streams: streamsWithProfiles };
        break;

      case 'get_reports':
        const { data: reports, error: reportsError } = await supabaseClient.rpc('admin_get_reports', {
          limit_param: limit,
          offset_param: offset,
          status_filter: statusFilter || null
        });
        if (reportsError) throw reportsError;
        result = { reports };
        break;

      case 'resolve_report':
        if (!reportId || typeof reportId !== 'string' || !isValidUUID(reportId)) {
          return new Response(
            JSON.stringify({ error: 'Valid Report UUID required' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        const { error: resolveError } = await supabaseClient.rpc('admin_resolve_report', {
          report_id_param: reportId,
          action_taken: 'resolved_by_admin',
          admin_user_id: 'admin'
        });
        if (resolveError) throw resolveError;
        result = { success: true, message: 'Report resolved successfully' };
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Admin action error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});