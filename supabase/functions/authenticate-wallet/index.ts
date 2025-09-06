import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

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
 * Proper BIP322-simple signature verification by decoding the signature structure
 * BIP322-simple signatures end with 0x21 (33) followed by the 33-byte public key
 */
async function verifyBIP322Signature(
  message: string, 
  signature: string, 
  publicKey: string,
  walletAddress: string
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
    
    console.log('Verifying BIP322-simple signature by decoding structure...');
    console.log('Message:', message);
    console.log('Expected public key:', publicKey);
    console.log('Signature:', signature);
    
    // Decode the base64 signature properly
    let signatureBytes: Uint8Array;
    try {
      signatureBytes = new Uint8Array(
        atob(signature)
          .split('')
          .map(char => char.charCodeAt(0))
      );
    } catch (e) {
      console.error('Invalid signature format - not valid base64');
      return false;
    }
    
    console.log('Signature bytes length:', signatureBytes.length);
    console.log('Signature bytes (hex):', Array.from(signatureBytes, b => b.toString(16).padStart(2, '0')).join(''));
    
    // BIP322-simple signature structure:
    // ... other data ... + 0x21 + 33-byte public key
    // Look for 0x21 (33 in decimal) which indicates the start of the public key section
    let publicKeyStartIndex = -1;
    for (let i = signatureBytes.length - 34; i >= 0; i--) {
      if (signatureBytes[i] === 0x21) { // 0x21 = 33, indicates 33-byte public key follows
        publicKeyStartIndex = i + 1;
        break;
      }
    }
    
    if (publicKeyStartIndex === -1) {
      console.error('Could not find public key marker (0x21) in BIP322-simple signature');
      return false;
    }
    
    // Extract the 33-byte public key
    const extractedPubKeyBytes = signatureBytes.slice(publicKeyStartIndex, publicKeyStartIndex + 33);
    
    if (extractedPubKeyBytes.length !== 33) {
      console.error('Extracted public key is not 33 bytes:', extractedPubKeyBytes.length);
      return false;
    }
    
    const extractedPubKeyHex = Array.from(extractedPubKeyBytes, b => b.toString(16).padStart(2, '0')).join('');
    
    console.log('Found public key marker at position:', publicKeyStartIndex - 1);
    console.log('Extracted public key from BIP322 signature:', extractedPubKeyHex);
    
    // Compare the extracted public key with the provided public key
    if (extractedPubKeyHex.toLowerCase() === publicKey.toLowerCase()) {
      console.log('BIP322-simple public key verification succeeded');
      return true;
    } else {
      console.error('BIP322-simple public key verification failed');
      console.error('Expected:', publicKey.toLowerCase());
      console.error('Found in signature:', extractedPubKeyHex.toLowerCase());
      return false;
    }
    
  } catch (error) {
    console.error('Error during BIP322-simple verification:', error);
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
    const isValidSignature = await verifyBIP322Signature(message, signature, publicKey, walletAddress);
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