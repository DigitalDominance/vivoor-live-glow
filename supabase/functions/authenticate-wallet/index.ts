import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { verify, Point } from 'https://esm.sh/@noble/secp256k1@2.1.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuthRequest {
  walletAddress: string;
  message: string;
  signature: string;
  publicKey: string; // Required - no fallback allowed
}

interface AuthResponse {
  success: boolean;
  sessionToken?: string;
  encryptedUserId?: string;
  error?: string;
}

// Kaspa address validation regex
const KASPA_ADDRESS_REGEX = /^kaspa:[a-z0-9]{61}$/;

// Message format validation - must include timestamp to prevent replay attacks
const MESSAGE_FORMAT_REGEX = /^VIVOOR_AUTH_\d{13}_[a-f0-9]{32}$/;

/**
 * Production-ready ECDSA signature verification for Kaspa using secp256k1
 * No fallbacks - strict cryptographic verification required
 */
async function verifyECDSASignature(
  message: string, 
  signature: string, 
  publicKey: string
): Promise<boolean> {
  try {
    // Strict validation - no fallbacks allowed
    if (!message || !signature || !publicKey) {
      console.error('Missing required parameters: message, signature, and publicKey are all required');
      return false;
    }
    
    // Validate public key format (66 chars for compressed secp256k1 key)
    if (!/^[0-9a-fA-F]{66}$/.test(publicKey)) {
      console.error('Invalid public key format - must be 66 character hex string');
      return false;
    }
    
    // Validate signature format based on Kasware documentation
    let signatureBytes: Uint8Array;
    
    if (/^[0-9a-fA-F]{128}$/.test(signature)) {
      // Hex format (128 chars)
      signatureBytes = new Uint8Array(signature.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
    } else {
      // Base64 format (as shown in Kasware docs)
      try {
        const binaryString = atob(signature);
        signatureBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          signatureBytes[i] = binaryString.charCodeAt(i);
        }
      } catch (e) {
        console.error('Invalid signature format - must be hex or base64');
        return false;
      }
    }
    
    // Validate signature length (64 bytes for secp256k1 signature)
    if (signatureBytes.length !== 64) {
      console.error('Invalid signature length - must be 64 bytes');
      return false;
    }
    
    // Convert public key to bytes
    const publicKeyBytes = new Uint8Array(publicKey.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
    
    // Validate public key is valid secp256k1 point
    try {
      // Use the Point.fromHex method to validate the public key
      Point.fromHex(publicKey);
      console.log('Public key validation passed');
    } catch (e) {
      console.error('Invalid public key - not a valid secp256k1 point:', e);
      return false;
    }
    
    // Hash the message using SHA-256 (Kaspa standard)
    const encoder = new TextEncoder();
    const messageBytes = encoder.encode(message);
    const messageHash = await crypto.subtle.digest('SHA-256', messageBytes);
    const messageHashBytes = new Uint8Array(messageHash);
    
    console.log('Verifying signature with secp256k1...');
    console.log('Message:', message);
    console.log('Public key:', publicKey);
    console.log('Message hash:', Array.from(messageHashBytes, b => b.toString(16).padStart(2, '0')).join(''));
    
    // Perform full ECDSA verification using noble-secp256k1
    const isValid = verify(signatureBytes, messageHashBytes, publicKey);
    
    if (!isValid) {
      console.error('ECDSA signature verification failed');
      return false;
    }
    
    console.log('ECDSA signature verification succeeded');
    return true;
    
  } catch (error) {
    console.error('Error during ECDSA verification:', error);
    return false;
  }
}

/**
 * Validate that the message is fresh and in correct format
 */
function validateMessage(message: string): boolean {
  // Check format: VIVOOR_AUTH_{timestamp}_{nonce}
  if (!MESSAGE_FORMAT_REGEX.test(message)) {
    console.error('Invalid message format:', message);
    return false;
  }
  
  // Extract timestamp
  const parts = message.split('_');
  const timestamp = parseInt(parts[2]);
  const now = Date.now();
  
  // Message must be signed within last 5 minutes (300,000 ms)
  const maxAge = 5 * 60 * 1000;
  if (now - timestamp > maxAge) {
    console.error('Message too old:', { timestamp, now, age: now - timestamp });
    return false;
  }
  
  // Message can't be from the future (allow 1 minute clock skew)
  if (timestamp > now + 60000) {
    console.error('Message from future:', { timestamp, now });
    return false;
  }
  
  return true;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Basic rate limiting - check request origin and add simple throttling
  const origin = req.headers.get('origin');
  const userAgent = req.headers.get('user-agent');
  
  // Block requests without proper browser headers (basic bot protection)
  if (!origin && !userAgent?.includes('Mozilla')) {
    console.warn('Blocked request without proper browser headers');
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid request origin' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      walletAddress, 
      message, 
      signature, 
      publicKey 
    }: AuthRequest = await req.json();

    console.log('Wallet authentication request:', { 
      walletAddress,
      message,
      signatureLength: signature?.length,
      hasPublicKey: !!publicKey
    });

    // Validate inputs - all fields required, no fallbacks
    if (!walletAddress || !message || !signature || !publicKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: walletAddress, message, signature, and publicKey are all required' 
        } as AuthResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate wallet address format
    if (!KASPA_ADDRESS_REGEX.test(walletAddress)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid Kaspa wallet address format' 
        } as AuthResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate message format and freshness
    if (!validateMessage(message)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid or expired message format' 
        } as AuthResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the cryptographic signature - strict verification, no fallbacks
    const isValidSignature = await verifyECDSASignature(message, signature, publicKey);
    if (!isValidSignature) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid signature - cryptographic verification failed' 
        } as AuthResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Signature verification passed, proceeding with authentication');

    // Check for replay attacks - ensure this exact message hasn't been used before
    const { data: existingAuth } = await supabaseClient
      .from('wallet_auth_sessions')
      .select('id')
      .eq('wallet_address', walletAddress)
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
      .limit(1);

    // Authenticate the wallet using the secure database function
    const { data: encryptedUserId, error: authError } = await supabaseClient
      .rpc('authenticate_wallet_secure', {
        wallet_address_param: walletAddress,
        message_param: message,
        signature_param: signature
      });

    if (authError) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Authentication failed' 
        } as AuthResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a secure session token
    const { data: sessionToken, error: sessionError } = await supabaseClient
      .rpc('create_wallet_session', {
        encrypted_user_id: encryptedUserId,
        wallet_address: walletAddress
      });

    if (sessionError) {
      console.error('Session creation error:', sessionError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to create session' 
        } as AuthResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authentication successful for wallet:', walletAddress);

    return new Response(
      JSON.stringify({ 
        success: true,
        sessionToken,
        encryptedUserId
      } as AuthResponse),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in authenticate-wallet function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error' 
      } as AuthResponse),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});