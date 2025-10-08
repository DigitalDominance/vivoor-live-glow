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

// ============= CHAT MESSAGE (PLAIN TEXT) =============
// Format: ciph_msg:1:bcast:{streamID}:{message}
// No encryption - plain text converted to hex

// Create chat message payload (NO ENCRYPTION - plain text to hex only)
export function createChatMessagePayload(
  streamId: string,
  messageContent: string
): string {
  // Create plain text payload in format: ciph_msg:1:bcast:{streamID}:{message}
  const payload = `ciph_msg:1:bcast:${streamId}:${messageContent}`;
  
  console.log('[ChatPayload] Plain text payload:', payload);
  
  // Convert to hex (NOT encryption, just encoding)
  const encoder = new TextEncoder();
  const bytes = encoder.encode(payload);
  const hexString = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  console.log('[ChatPayload] Hex payload:', hexString);
  console.log('[ChatPayload] Hex length:', hexString.length);
  
  return hexString;
}

// Parse chat message from plain text payload
export function parseChatMessagePayload(payloadHex: string): {
  identifier: string;
  version: string;
  broadcast: string;
  streamId: string;
  messageContent: string;
} | null {
  try {
    // Convert hex to string
    const bytes: number[] = [];
    for (let i = 0; i < payloadHex.length; i += 2) {
      const byte = parseInt(payloadHex.slice(i, i + 2), 16);
      if (!Number.isNaN(byte)) bytes.push(byte);
    }
    const payloadText = new TextDecoder().decode(new Uint8Array(bytes));
    
    // Parse format: ciph_msg:1:bcast:{streamID}:{message}
    const parts = payloadText.split(':');
    if (parts.length < 5) {
      return null;
    }
    
    const identifier = parts[0]; // ciph_msg
    const version = parts[1]; // 1
    const broadcast = parts[2]; // bcast
    const streamId = parts[3];
    const messageContent = parts.slice(4).join(':'); // Handle colons in message
    
    // Verify format
    if (identifier !== 'ciph_msg' || version !== '1' || broadcast !== 'bcast') {
      return null;
    }
    
    return {
      identifier,
      version,
      broadcast,
      streamId,
      messageContent
    };
  } catch (error) {
    console.error('Parse error:', error);
    return null;
  }
}

// Extract chat identifier from transaction payload
export function extractChatFromPayload(payloadHex?: string | null): string | undefined {
  if (!payloadHex) return undefined;
  
  try {
    // Convert hex payload to string
    const bytes: number[] = [];
    for (let i = 0; i < payloadHex.length; i += 2) {
      const byte = parseInt(payloadHex.slice(i, i + 2), 16);
      if (!Number.isNaN(byte)) bytes.push(byte);
    }
    const payloadText = new TextDecoder().decode(new Uint8Array(bytes));
    
    // Check for new format: ciph_msg:1:bcast:
    if (payloadText.includes('ciph_msg:1:bcast:')) {
      return payloadHex;
    }
  } catch (error) {
    console.error('Error extracting chat from payload:', error);
  }
  
  return undefined;
}