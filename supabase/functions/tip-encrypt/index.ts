import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Encryption utilities for Kaspa tip messages
// Uses AES-GCM for symmetric encryption with secure secret

const TIP_IDENTIFIER = "VIVR-TIP1:";

// Simple key derivation from string to CryptoKey
async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const data = encoder.encode(passphrase);
  
  // Use SHA-256 to create a consistent key from passphrase
  const hash = await crypto.subtle.digest('SHA-256', data);
  
  return crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt a tip message
async function encryptTipMessage(message: string, amount: number, senderHandle: string, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  
  // Create payload object
  const payload = {
    message,
    amount,
    sender: senderHandle,
    timestamp: Date.now()
  };
  
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the data
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  // Convert to hex string
  const hexString = Array.from(combined)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return TIP_IDENTIFIER + hexString;
}

// Decrypt a tip message
async function decryptTipMessage(encryptedPayload: string, secret: string): Promise<{
  message: string;
  amount: number;
  sender: string;
  timestamp: number;
} | null> {
  try {
    // Remove identifier prefix
    if (!encryptedPayload.startsWith(TIP_IDENTIFIER)) {
      return null;
    }
    
    const hexData = encryptedPayload.slice(TIP_IDENTIFIER.length);
    
    // Convert hex to bytes
    const bytes = new Uint8Array(
      hexData.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );
    
    if (bytes.length < 12) {
      return null;
    }
    
    // Extract IV and encrypted data
    const iv = bytes.slice(0, 12);
    const encrypted = bytes.slice(12);
    
    const key = await deriveKey(secret);
    
    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decrypted);
    
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const tipSecret = Deno.env.get('TIP_ENCRYPTION_SECRET');
    if (!tipSecret) {
      throw new Error('TIP_ENCRYPTION_SECRET not configured');
    }

    const { action, ...data } = await req.json();

    if (action === 'encrypt') {
      const { message, amount, senderHandle } = data;
      
      if (!message || !amount || !senderHandle) {
        throw new Error('Missing required fields for encryption');
      }

      const encryptedMessage = await encryptTipMessage(message, amount, senderHandle, tipSecret);
      
      return new Response(
        JSON.stringify({ encryptedMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } 
    
    if (action === 'decrypt') {
      const { encryptedPayload } = data;
      
      if (!encryptedPayload) {
        throw new Error('Missing encrypted payload for decryption');
      }

      const decryptedData = await decryptTipMessage(encryptedPayload, tipSecret);
      
      return new Response(
        JSON.stringify({ decryptedData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action. Use "encrypt" or "decrypt"');

  } catch (error) {
    console.error('Error in tip-encrypt function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});