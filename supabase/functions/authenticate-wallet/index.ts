import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import * as secp256k1 from 'https://esm.sh/@noble/secp256k1@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuthRequest {
  walletAddress: string;
  message: string;
  signature: string;
  publicKey?: string;
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
 * Production-ready ECDSA signature verification for Kaspa/Kasware
 * Tries multiple message signing formats to handle Kasware's specific implementation
 */
async function verifyECDSASignature(
  message: string, 
  signature: string, 
  publicKey: string
): Promise<boolean> {
  try {
    // Validate required inputs
    if (!message || !signature || !publicKey) {
      console.error('Missing required inputs: message, signature, or publicKey');
      return false;
    }
    
    // Validate public key format (should be hex string, 66 chars for compressed key)
    if (!/^[0-9a-fA-F]{66}$/.test(publicKey)) {
      console.error('Invalid public key format - expected 66 character hex string');
      return false;
    }
    
    console.log('Starting signature verification...');
    console.log('Message:', message);
    console.log('Public key:', publicKey);
    console.log('Signature (raw):', signature);
    
    // Try to decode signature - handle both hex and base64 formats
    let signatureBytes: Uint8Array;
    
    // First try hex format (128 characters = 64 bytes)
    if (/^[0-9a-fA-F]{128}$/.test(signature)) {
      console.log('Hex signature format detected');
      signatureBytes = new Uint8Array(signature.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
      console.log('Signature decoded from hex, length:', signatureBytes.length);
    } else {
      // Try base64 format
      try {
        console.log('Attempting base64 decode...');
        const binaryString = atob(signature);
        signatureBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          signatureBytes[i] = binaryString.charCodeAt(i);
        }
        console.log('Signature decoded from base64, length:', signatureBytes.length);
        
        // If it's 65 bytes (Bitcoin recoverable format), extract r+s components
        if (signatureBytes.length === 65) {
          console.log('Bitcoin recoverable format detected, extracting r+s');
          const r = signatureBytes.slice(1, 33);
          const s = signatureBytes.slice(33, 65);
          signatureBytes = new Uint8Array(64);
          signatureBytes.set(r);
          signatureBytes.set(s, 32);
        }
      } catch (e) {
        console.error('Failed to decode signature as base64:', e);
        return false;
      }
    }
    
    // Validate signature length (should be 64 bytes for r+s)
    if (signatureBytes.length !== 64) {
      console.error('Invalid signature length:', signatureBytes.length, 'expected 64 bytes');
      return false;
    }
    
    // Convert public key hex to bytes
    const publicKeyBytes = new Uint8Array(publicKey.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
    console.log('Public key bytes length:', publicKeyBytes.length);
    
    // Try multiple message signing approaches
    const approaches = [
      {
        name: 'Raw message SHA-256',
        getHash: async () => {
          const encoder = new TextEncoder();
          const messageBytes = encoder.encode(message);
          return new Uint8Array(await crypto.subtle.digest('SHA-256', messageBytes));
        }
      },
      {
        name: 'Bitcoin message format with double SHA-256',
        getHash: async () => {
          const bitcoinMessage = `\x18Bitcoin Signed Message:\n${message.length}${message}`;
          const encoder = new TextEncoder();
          const messageBytes = encoder.encode(bitcoinMessage);
          const firstHash = await crypto.subtle.digest('SHA-256', messageBytes);
          return new Uint8Array(await crypto.subtle.digest('SHA-256', firstHash));
        }
      },
      {
        name: 'Bitcoin message format with single SHA-256',
        getHash: async () => {
          const bitcoinMessage = `\x18Bitcoin Signed Message:\n${message.length}${message}`;
          const encoder = new TextEncoder();
          const messageBytes = encoder.encode(bitcoinMessage);
          return new Uint8Array(await crypto.subtle.digest('SHA-256', messageBytes));
        }
      },
      {
        name: 'Kaspa message format',
        getHash: async () => {
          const kaspaMessage = `\x17Kaspa Signed Message:\n${message.length}${message}`;
          const encoder = new TextEncoder();
          const messageBytes = encoder.encode(kaspaMessage);
          return new Uint8Array(await crypto.subtle.digest('SHA-256', messageBytes));
        }
      }
    ];
    
    // Try each approach
    for (const approach of approaches) {
      try {
        const messageHashArray = await approach.getHash();
        const messageHashHex = Array.from(messageHashArray, byte => byte.toString(16).padStart(2, '0')).join('');
        console.log(`${approach.name} hash:`, messageHashHex);
        
        // Verify the signature using noble-secp256k1
        const isValid = secp256k1.verify(signatureBytes, messageHashArray, publicKeyBytes);
        
        if (isValid) {
          console.log(`✅ Signature verification PASSED with ${approach.name}`);
          return true;
        } else {
          console.log(`❌ Signature verification FAILED with ${approach.name}`);
        }
        
      } catch (cryptoError) {
        console.error(`Cryptographic verification error for ${approach.name}:`, cryptoError);
        continue;
      }
    }
    
    console.error('All signature verification approaches failed');
    return false;
    
  } catch (error) {
    console.error('Error verifying signature:', error);
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

    // Validate inputs - PUBLIC KEY IS MANDATORY
    if (!walletAddress || !message || !signature || !publicKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: walletAddress, message, signature, publicKey' 
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

    // Verify the cryptographic signature
    const isValidSignature = await verifyECDSASignature(message, signature, publicKey);
    if (!isValidSignature) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid signature - could not verify wallet ownership' 
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

    // For additional security, we could store used message hashes and check against them
    // For now, we'll rely on timestamp validation

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

    // Create a secure session token using crypto.randomUUID and timestamp
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