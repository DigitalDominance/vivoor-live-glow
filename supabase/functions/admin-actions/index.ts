import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const body: AdminAction = await req.json();
    const { action, password, userId, streamId, reportId, search, offset = 0, limit = 50, statusFilter } = body;

    // Verify admin password for all actions
    if (password !== adminPassword) {
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
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'User ID required' }),
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
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'User ID required' }),
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
        if (!streamId) {
          return new Response(
            JSON.stringify({ error: 'Stream ID required' }),
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
        const { data: users, error: usersError } = await supabaseClient.rpc('admin_get_users', {
          search_query: search || null,
          limit_param: limit,
          offset_param: offset
        });
        if (usersError) throw usersError;
        result = { users };
        break;

      case 'get_live_streams':
        const { data: streams, error: streamsError } = await supabaseClient
          .from('streams')
          .select(`
            id,
            title,
            user_id,
            viewers,
            created_at,
            stream_type,
            profiles!inner(handle, display_name, avatar_url)
          `)
          .eq('is_live', true)
          .order('created_at', { ascending: false })
          .limit(limit)
          .range(offset, offset + limit - 1);
        
        if (streamsError) throw streamsError;
        result = { streams };
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
        if (!reportId) {
          return new Response(
            JSON.stringify({ error: 'Report ID required' }),
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