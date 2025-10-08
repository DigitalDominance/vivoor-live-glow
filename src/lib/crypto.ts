// Encryption utilities for Kaspa tip messages
// Uses AES-GCM for symmetric encryption with shared secret

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
export async function encryptTipMessage(message: string, amount: number, senderHandle: string): Promise<string> {
  try {
    // Use a shared secret - in production, this should be more secure
    const sharedSecret = "VIVOOR_TIP_SECRET_2025";
    const key = await deriveKey(sharedSecret);
    
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
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt tip message');
  }
}

// Decrypt a tip message
export async function decryptTipMessage(encryptedPayload: string): Promise<{
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
    
    // Use same shared secret
    const sharedSecret = "VIVOOR_TIP_SECRET_2025";
    const key = await deriveKey(sharedSecret);
    
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

// ============= CHAT MESSAGE ENCRYPTION =============
// Format: ciph_msg:1:bcast:{streamID}:{message}
const CHAT_IDENTIFIER = "ciph_msg";

// Encrypt a chat message with format ciph_msg:1:bcast:{streamID}:{message}
export async function encryptChatMessage(
  streamId: string,
  messageContent: string
): Promise<string> {
  try {
    const sharedSecret = "VIVOOR_CHAT_SECRET_2025";
    const key = await deriveKey(sharedSecret);
    
    // Create payload with format: ciph_msg:1:bcast:{streamID}:{message}
    const payload = `${CHAT_IDENTIFIER}:1:bcast:${streamId}:${messageContent}`;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    
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
    
    return hexString;
  } catch (error) {
    console.error('Chat encryption error:', error);
    throw new Error('Failed to encrypt chat message');
  }
}

// Decrypt a chat message - format: ciph_msg:1:bcast:{streamID}:{message}
export async function decryptChatMessage(encryptedPayload: string): Promise<{
  streamId: string;
  messageContent: string;
} | null> {
  try {
    const sharedSecret = "VIVOOR_CHAT_SECRET_2025";
    const key = await deriveKey(sharedSecret);
    
    // Convert hex to bytes
    const bytes = new Uint8Array(
      encryptedPayload.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );
    
    if (bytes.length < 12) {
      return null;
    }
    
    // Extract IV and encrypted data
    const iv = bytes.slice(0, 12);
    const encrypted = bytes.slice(12);
    
    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    const payloadString = decoder.decode(decrypted);
    
    // Parse the format: ciph_msg:1:bcast:{streamID}:{message}
    const parts = payloadString.split(':');
    if (parts.length < 5) {
      return null;
    }
    
    const identifier = parts[0];
    const version = parts[1];
    const broadcast = parts[2];
    const streamId = parts[3];
    const messageContent = parts.slice(4).join(':'); // Rejoin in case message contains colons
    
    // Verify format
    if (identifier !== CHAT_IDENTIFIER || version !== '1' || broadcast !== 'bcast') {
      return null;
    }
    
    return {
      streamId,
      messageContent
    };
  } catch (error) {
    console.error('Chat decryption error:', error);
    return null;
  }
}

// Extract chat identifier from transaction payload (no longer needed - payload is just hex now)
export function extractChatFromPayload(payloadHex?: string | null): string | undefined {
  // Payload is now directly the encrypted hex, no prefix needed
  return payloadHex || undefined;
}