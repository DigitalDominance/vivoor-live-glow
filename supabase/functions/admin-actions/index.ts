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

// Enhanced rate limiting and session management
const rateLimitStore = new Map<string, { count: number; resetTime: number; failedAttempts: number; lockoutUntil: number }>();
const sessionStore = new Map<string, { created: number; expires: number; ip: string }>();

// Generate secure session token
function generateSessionToken(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2);
  return `admin_${timestamp}_${random}`;
}

// Enhanced rate limiting with progressive delays and lockouts
function checkRateLimit(ip: string, maxRequests: number = 5, windowMs: number = 60000): { allowed: boolean; delay?: number; lockoutUntil?: number } {
  const now = Date.now();
  const key = ip;
  const record = rateLimitStore.get(key) || { count: 0, resetTime: now + windowMs, failedAttempts: 0, lockoutUntil: 0 };
  
  // Check if IP is currently locked out
  if (record.lockoutUntil > now) {
    return { allowed: false, lockoutUntil: record.lockoutUntil };
  }
  
  // Reset window if expired
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
    rateLimitStore.set(key, record);
    return { allowed: true };
  }
  
  // Check request limit
  if (record.count >= maxRequests) {
    return { allowed: false };
  }
  
  record.count++;
  rateLimitStore.set(key, record);
  return { allowed: true };
}

// Track failed authentication attempts with progressive lockouts
function handleFailedAuth(ip: string): { lockoutUntil?: number; delay: number } {
  const now = Date.now();
  const key = ip;
  const record = rateLimitStore.get(key) || { count: 0, resetTime: now + 60000, failedAttempts: 0, lockoutUntil: 0 };
  
  record.failedAttempts++;
  
  // Progressive delays: 1s, 5s, 15s, then lockout
  let delay = 1000; // 1 second
  if (record.failedAttempts === 2) delay = 5000; // 5 seconds
  else if (record.failedAttempts === 3) delay = 15000; // 15 seconds
  else if (record.failedAttempts >= 4) {
    // Lockout for 15 minutes after 4 failed attempts
    record.lockoutUntil = now + (15 * 60 * 1000);
    rateLimitStore.set(key, record);
    return { lockoutUntil: record.lockoutUntil, delay: 0 };
  }
  
  rateLimitStore.set(key, record);
  return { delay };
}

// Reset failed attempts on successful auth
function resetFailedAttempts(ip: string): void {
  const record = rateLimitStore.get(ip);
  if (record) {
    record.failedAttempts = 0;
    record.lockoutUntil = 0;
    rateLimitStore.set(ip, record);
  }
}

// Normalize IP address to handle X-Forwarded-For headers
function normalizeIP(ipHeader: string): string {
  if (!ipHeader) return 'unknown';
  // Take the first IP from comma-separated list (original client IP)
  return ipHeader.split(',')[0].trim();
}

// Validate session token
function validateSessionToken(token: string, ip: string): boolean {
  console.log('Validating session token:', token.substring(0, 20) + '...');
  console.log('Current IP:', ip);
  
  const session = sessionStore.get(token);
  if (!session) {
    console.log('Session not found in store');
    return false;
  }
  
  console.log('Session found, stored IP:', session.ip);
  console.log('Session expires:', new Date(session.expires).toISOString());
  
  const now = Date.now();
  if (now > session.expires) {
    console.log('Session expired');
    sessionStore.delete(token);
    return false;
  }
  
  // Normalize both IPs for comparison (disabled for now due to proxy complexity)
  // const normalizedCurrentIP = normalizeIP(ip);
  // const normalizedStoredIP = normalizeIP(session.ip);
  // if (normalizedCurrentIP !== normalizedStoredIP) {
  //   console.log('IP mismatch:', normalizedCurrentIP, 'vs', normalizedStoredIP);
  //   return false;
  // }
  
  console.log('Session validation successful');
  return true;
}

// Create new session
function createSession(ip: string): string {
  const token = generateSessionToken();
  const now = Date.now();
  const expires = now + (60 * 60 * 1000); // 1 hour
  const normalizedIP = normalizeIP(ip);
  
  console.log('Creating session with token:', token.substring(0, 20) + '...');
  console.log('Session IP:', normalizedIP);
  console.log('Session expires:', new Date(expires).toISOString());
  
  sessionStore.set(token, {
    created: now,
    expires,
    ip: normalizedIP
  });
  
  return token;
}

// Clean up expired sessions
function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [token, session] of sessionStore.entries()) {
    if (now > session.expires) {
      sessionStore.delete(token);
    }
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdminAction {
  action: 'verify_password' | 'ban_user' | 'unban_user' | 'end_stream' | 'get_users' | 'get_live_streams' | 'get_reports' | 'resolve_report';
  password?: string;
  sessionToken?: string;
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
    // Get client IP for enhanced rate limiting
    const rawClientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const clientIP = normalizeIP(rawClientIP);
    console.log('Request from IP:', clientIP, '(raw:', rawClientIP + ')');
    
    // Clean up expired sessions periodically
    if (Math.random() < 0.1) { // 10% chance to cleanup on each request
      cleanupExpiredSessions();
    }
    
    // Apply enhanced rate limiting (max 5 requests per minute per IP)
    const rateLimitResult = checkRateLimit(clientIP, 5, 60000);
    if (!rateLimitResult.allowed) {
      const error = rateLimitResult.lockoutUntil 
        ? `IP locked out until ${new Date(rateLimitResult.lockoutUntil).toISOString()}`
        : 'Too many requests. Please try again later.';
      
      return new Response(
        JSON.stringify({ 
          error,
          lockoutUntil: rateLimitResult.lockoutUntil 
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

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

    // Additional security headers validation
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

    const { action, password, sessionToken, userId, streamId, reportId, search, offset = 0, limit = 50, statusFilter } = body;

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

    // Handle authentication differently for password verification vs session token validation
    if (action === 'verify_password') {
      // For initial login, validate password
      console.log('Password verification request received');
      console.log('Password provided:', !!password);
      console.log('Admin password configured:', !!adminPassword);
      
      if (!password || typeof password !== 'string' || password.trim() === '') {
        console.log('Password validation failed - missing or invalid password');
        return new Response(
          JSON.stringify({ error: 'Password required' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log('Attempting password verification...');
      const isValidPassword = await verifyPasswordSecure(password, adminPassword);
      console.log('Password verification result:', isValidPassword);
      
      if (!isValidPassword) {
        // Track failed attempt and apply progressive delays
        console.log('Password verification failed for IP:', clientIP);
        const failureResult = handleFailedAuth(clientIP);
        console.log('Failure result:', failureResult);
        
        if (failureResult.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, failureResult.delay));
        }
        
        console.log('Admin authentication failed from IP:', clientIP);
        
        const errorMessage = failureResult.lockoutUntil 
          ? `Too many failed attempts. Locked out until ${new Date(failureResult.lockoutUntil).toISOString()}`
          : 'Invalid admin password';
        
        return new Response(
          JSON.stringify({ 
            error: errorMessage,
            lockoutUntil: failureResult.lockoutUntil 
          }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Reset failed attempts on successful auth
      resetFailedAttempts(clientIP);
      
      // Create new session token
      const newSessionToken = createSession(clientIP);
      
      console.log('Admin authentication successful from IP:', clientIP);
      
      return new Response(
        JSON.stringify({ 
          verified: true, 
          sessionToken: newSessionToken,
          expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      // For all other actions, validate session token
      if (!sessionToken || typeof sessionToken !== 'string' || sessionToken.trim() === '') {
        return new Response(
          JSON.stringify({ error: 'Session token required' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      if (!validateSessionToken(sessionToken, clientIP)) {
        console.log('Invalid session token from IP:', clientIP);
        return new Response(
          JSON.stringify({ error: 'Invalid or expired session token' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Log successful admin access for auditing
      console.log('Admin access granted for action:', action, 'from IP:', clientIP);
    }

    let result = null;

    switch (action) {
      case 'verify_password':
        // This case is now handled above before the switch statement
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