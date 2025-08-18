// Input validation and sanitization utilities

// Sanitize HTML to prevent XSS attacks
export function sanitizeText(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove HTML brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

// Validate chat message
export function validateChatMessage(message: string): { isValid: boolean; error?: string; sanitized: string } {
  const sanitized = sanitizeText(message);
  
  if (sanitized.length === 0) {
    return { isValid: false, error: 'Message cannot be empty', sanitized };
  }
  
  if (sanitized.length > 500) {
    return { isValid: false, error: 'Message too long (max 500 characters)', sanitized };
  }
  
  // Check for spam patterns
  const spamPatterns = [
    /(.)\1{10,}/, // Repeated characters
    /https?:\/\/[^\s]{10,}/gi, // Long URLs
    /[\u0080-\uFFFF]{20,}/, // Too much unicode
  ];
  
  for (const pattern of spamPatterns) {
    if (pattern.test(sanitized)) {
      return { isValid: false, error: 'Message contains spam patterns', sanitized };
    }
  }
  
  return { isValid: true, sanitized };
}

// Validate username
export function validateUsername(username: string): { isValid: boolean; error?: string; sanitized: string } {
  const sanitized = sanitizeText(username);
  
  if (sanitized.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters', sanitized };
  }
  
  if (sanitized.length > 20) {
    return { isValid: false, error: 'Username must be 20 characters or less', sanitized };
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(sanitized)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, and underscores', sanitized };
  }
  
  // Check for inappropriate words (basic filter)
  const bannedWords = ['admin', 'moderator', 'system', 'official', 'support'];
  const lowerUsername = sanitized.toLowerCase();
  
  for (const word of bannedWords) {
    if (lowerUsername.includes(word)) {
      return { isValid: false, error: 'Username contains restricted words', sanitized };
    }
  }
  
  return { isValid: true, sanitized };
}

// Validate tip message
export function validateTipMessage(message: string): { isValid: boolean; error?: string; sanitized: string } {
  const sanitized = sanitizeText(message);
  
  if (sanitized.length > 200) {
    return { isValid: false, error: 'Tip message too long (max 200 characters)', sanitized };
  }
  
  return { isValid: true, sanitized };
}

// Validate tip amount
export function validateTipAmount(amount: number): { isValid: boolean; error?: string } {
  if (isNaN(amount) || amount <= 0) {
    return { isValid: false, error: 'Amount must be a positive number' };
  }
  
  if (amount < 0.001) {
    return { isValid: false, error: 'Minimum tip amount is 0.001 KAS' };
  }
  
  if (amount > 1000000) {
    return { isValid: false, error: 'Maximum tip amount is 1,000,000 KAS' };
  }
  
  return { isValid: true };
}

// Rate limiting helpers (client-side)
const rateLimitCache = new Map<string, number[]>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const requests = rateLimitCache.get(key) || [];
  
  // Remove old requests outside the window
  const validRequests = requests.filter(time => now - time < windowMs);
  
  if (validRequests.length >= maxRequests) {
    return false; // Rate limit exceeded
  }
  
  // Add current request
  validRequests.push(now);
  rateLimitCache.set(key, validRequests);
  
  return true;
}