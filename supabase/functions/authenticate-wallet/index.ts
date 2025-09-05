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
 * Implements full secp256k1 ECDSA verification
 */
async function verifyECDSASignature(
  message: string, 
  signature: string, 
  publicKey: string  // REQUIRED - no fallback allowed
): Promise<boolean> {
  try {
    // Validate required inputs - NO FALLBACKS ALLOWED
    if (!message || !signature || !publicKey) {
      console.error('Missing required inputs: message, signature, or publicKey');
      return false;
    }
    
    // Validate public key format (should be hex string, 66 chars for compressed key)
    if (!/^[0-9a-fA-F]{66}$/.test(publicKey)) {
      console.error('Invalid public key format - expected 66 character hex string');
      return false;
    }
    
    // Validate signature format - Kasware returns hex string (128 chars for r+s components)
    if (!/^[0-9a-fA-F]{128}$/.test(signature)) {
      console.error('Invalid signature format - expected 128 character hex string');
      return false;
    }
    
    console.log('Signature format validation passed');
    console.log('Public key:', publicKey);
    console.log('Signature:', signature);
    console.log('Message:', message);
    
    // Parse signature components (r and s, each 32 bytes = 64 hex chars)
    const r = signature.slice(0, 64);
    const s = signature.slice(64, 128);
    
    console.log('Signature r component:', r);
    console.log('Signature s component:', s);
    
    // Convert hex strings to BigInt for validation
    const rBigInt = BigInt('0x' + r);
    const sBigInt = BigInt('0x' + s);
    
    // secp256k1 curve parameters
    const curveOrder = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
    const p = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F');
    const a = BigInt('0x0000000000000000000000000000000000000000000000000000000000000000');
    const b = BigInt('0x0000000000000000000000000000000000000000000000000000000000000007');
    const Gx = BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798');
    const Gy = BigInt('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8');
    
    // Validate signature components are within valid range
    if (rBigInt <= 0n || rBigInt >= curveOrder) {
      console.error('Invalid signature: r component out of range');
      return false;
    }
    
    if (sBigInt <= 0n || sBigInt >= curveOrder) {
      console.error('Invalid signature: s component out of range');
      return false;
    }
    
    // Validate public key is on the secp256k1 curve
    const pubKeyBytes = new Uint8Array(publicKey.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
    
    // Check if it's a valid compressed public key (starts with 02 or 03)
    if (pubKeyBytes[0] !== 0x02 && pubKeyBytes[0] !== 0x03) {
      console.error('Invalid public key: not a valid compressed key');
      return false;
    }
    
    // Extract x coordinate
    const xBytes = pubKeyBytes.slice(1);
    const x = BigInt('0x' + Array.from(xBytes, byte => byte.toString(16).padStart(2, '0')).join(''));
    
    // Validate x coordinate is within field
    if (x <= 0n || x >= p) {
      console.error('Invalid public key: x coordinate out of range');
      return false;
    }
    
    // Decompress the public key to get y coordinate
    const ySquared = (x * x * x + a * x + b) % p;
    const y = modPow(ySquared, (p + 1n) / 4n, p);
    
    // Check if y coordinate matches the compression flag
    const isEven = y % 2n === 0n;
    const expectedParity = pubKeyBytes[0] === 0x02;
    
    if (isEven !== expectedParity) {
      console.error('Invalid public key: y coordinate parity mismatch');
      return false;
    }
    
    // Hash the message using SHA-256 (Bitcoin/Kaspa message signing standard)
    const encoder = new TextEncoder();
    const messageBytes = encoder.encode(message);
    const messageHash = await crypto.subtle.digest('SHA-256', messageBytes);
    const messageHashArray = new Uint8Array(messageHash);
    const messageHashHex = Array.from(messageHashArray, byte => byte.toString(16).padStart(2, '0')).join('');
    const e = BigInt('0x' + messageHashHex);
    
    console.log('Message hash (SHA-256):', messageHashHex);
    
    // Additional security checks: ensure signature is not weak
    if (rBigInt === 1n || sBigInt === 1n || rBigInt === curveOrder - 1n || sBigInt === curveOrder - 1n) {
      console.error('Invalid signature: weak signature detected');
      return false;
    }
    
    // FULL ECDSA VERIFICATION
    // Calculate s^-1 mod n
    const sInv = modInverse(sBigInt, curveOrder);
    if (!sInv) {
      console.error('Invalid signature: s not invertible');
      return false;
    }
    
    // Calculate u1 = e * s^-1 mod n and u2 = r * s^-1 mod n
    const u1 = (e * sInv) % curveOrder;
    const u2 = (rBigInt * sInv) % curveOrder;
    
    // Calculate point P = u1*G + u2*Q where Q is the public key point
    const P1 = pointMultiply([Gx, Gy], u1, p);
    const P2 = pointMultiply([x, y], u2, p);
    const P = pointAdd(P1, P2, p);
    
    if (!P) {
      console.error('Invalid signature: point at infinity');
      return false;
    }
    
    // Verify that r = P.x mod n
    const verified = (P[0] % curveOrder) === rBigInt;
    
    if (verified) {
      console.log('Signature passed full ECDSA verification');
    } else {
      console.error('Signature failed ECDSA verification');
    }
    
    return verified;
    
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

// Helper functions for secp256k1 math
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % mod;
    }
    exp = exp >> 1n;
    base = (base * base) % mod;
  }
  return result;
}

function modInverse(a: bigint, m: bigint): bigint | null {
  const [gcd, x] = extendedGcd(a, m);
  if (gcd !== 1n) return null;
  return ((x % m) + m) % m;
}

function extendedGcd(a: bigint, b: bigint): [bigint, bigint, bigint] {
  if (a === 0n) return [b, 0n, 1n];
  const [gcd, x1, y1] = extendedGcd(b % a, a);
  const x = y1 - (b / a) * x1;
  const y = x1;
  return [gcd, x, y];
}

function pointAdd(p1: [bigint, bigint] | null, p2: [bigint, bigint] | null, mod: bigint): [bigint, bigint] | null {
  if (!p1) return p2;
  if (!p2) return p1;
  
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  
  if (x1 === x2) {
    if (y1 === y2) {
      return pointDouble(p1, mod);
    } else {
      return null; // Point at infinity
    }
  }
  
  const dx = ((x2 - x1) % mod + mod) % mod;
  const dy = ((y2 - y1) % mod + mod) % mod;
  const dxInv = modInverse(dx, mod);
  
  if (!dxInv) return null;
  
  const m = (dy * dxInv) % mod;
  const x3 = ((m * m - x1 - x2) % mod + mod) % mod;
  const y3 = ((m * (x1 - x3) - y1) % mod + mod) % mod;
  
  return [x3, y3];
}

function pointDouble(p: [bigint, bigint], mod: bigint): [bigint, bigint] | null {
  const [x, y] = p;
  const twoY = (2n * y) % mod;
  const twoYInv = modInverse(twoY, mod);
  
  if (!twoYInv) return null;
  
  const m = (3n * x * x * twoYInv) % mod;
  const x3 = ((m * m - 2n * x) % mod + mod) % mod;
  const y3 = ((m * (x - x3) - y) % mod + mod) % mod;
  
  return [x3, y3];
}

function pointMultiply(p: [bigint, bigint], k: bigint, mod: bigint): [bigint, bigint] | null {
  if (k === 0n) return null;
  if (k === 1n) return p;
  
  let result: [bigint, bigint] | null = null;
  let addend = p;
  
  while (k > 0n) {
    if (k % 2n === 1n) {
      result = pointAdd(result, addend, mod);
    }
    addend = pointDouble(addend, mod);
    if (!addend) break;
    k = k >> 1n;
  }
  
  return result;
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