// Secure encryption utilities for Kaspa tip messages
// Uses server-side encryption via Supabase Edge Functions

import { supabase } from "@/integrations/supabase/client";

const TIP_IDENTIFIER = "VIVR-TIP1:";

// Encrypt a tip message using secure server-side encryption
export async function encryptTipMessage(message: string, amount: number, senderHandle: string): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('tip-encrypt', {
      body: {
        action: 'encrypt',
        message,
        amount,
        senderHandle
      }
    });

    if (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt tip message');
    }

    return data.encryptedMessage;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt tip message');
  }
}

// Decrypt a tip message using secure server-side decryption
export async function decryptTipMessage(encryptedPayload: string): Promise<{
  message: string;
  amount: number;
  sender: string;
  timestamp: number;
} | null> {
  try {
    // Quick client-side check
    if (!encryptedPayload.startsWith(TIP_IDENTIFIER)) {
      return null;
    }

    const { data, error } = await supabase.functions.invoke('tip-encrypt', {
      body: {
        action: 'decrypt',
        encryptedPayload
      }
    });

    if (error) {
      console.error('Decryption error:', error);
      return null;
    }

    return data.decryptedData;
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

// Extract tip identifier from signature script hex
export function extractTipFromSignature(signatureHex?: string | null): string | undefined {
  if (!signatureHex) return undefined;
  
  const upperHex = signatureHex.toUpperCase();
  const identifierHex = Array.from(TIP_IDENTIFIER)
    .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('').toUpperCase();
  
  const index = upperHex.indexOf(identifierHex);
  if (index === -1) return undefined;
  
  // Extract everything from the identifier onwards
  return TIP_IDENTIFIER + upperHex.slice(index + identifierHex.length);
}