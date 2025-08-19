// Simple bad words filter implementation
// Since the bad-words package has import issues, we'll create a basic implementation

const badWordsList = [
  // Common profanity
  'fuck', 'shit', 'bitch', 'ass', 'damn', 'hell', 'crap', 'piss',
  // Offensive terms
  'nazi', 'hitler', 'racist', 'hate', 'kill', 'die', 'suicide', 'rape',
  // Scam-related terms
  'scam', 'fraud', 'ponzi', 'rugpull', 'spam', 'fake', 'steal',
  // Add more as needed
  'idiot', 'stupid', 'retard', 'moron', 'dumb'
];

/**
 * Checks if a text contains inappropriate language
 * @param text - The text to check
 * @returns true if the text contains bad words, false otherwise
 */
export function containsBadWords(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  
  const lowerText = text.toLowerCase();
  return badWordsList.some(badWord => 
    lowerText.includes(badWord.toLowerCase())
  );
}

/**
 * Cleans inappropriate language from text
 * @param text - The text to clean
 * @returns The cleaned text with bad words replaced
 */
export function cleanText(text: string): string {
  if (!text || typeof text !== 'string') return text;
  
  let cleanedText = text;
  badWordsList.forEach(badWord => {
    const regex = new RegExp(badWord, 'gi');
    cleanedText = cleanedText.replace(regex, '*'.repeat(badWord.length));
  });
  
  return cleanedText;
}

/**
 * Validates if a username is appropriate
 * @param username - The username to validate
 * @returns Object with isValid boolean and error message if invalid
 */
export function validateUsername(username: string): { isValid: boolean; error?: string } {
  if (!username || typeof username !== 'string') {
    return { isValid: false, error: 'Username is required' };
  }

  if (username.length < 3 || username.length > 20) {
    return { isValid: false, error: 'Username must be between 3 and 20 characters' };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }

  if (containsBadWords(username)) {
    return { isValid: false, error: 'Username contains inappropriate language' };
  }

  return { isValid: true };
}

/**
 * Validates if a bio is appropriate
 * @param bio - The bio to validate
 * @returns Object with isValid boolean and error message if invalid
 */
export function validateBio(bio: string): { isValid: boolean; error?: string } {
  if (!bio || typeof bio !== 'string') {
    return { isValid: true }; // Bio is optional
  }

  if (bio.length > 200) {
    return { isValid: false, error: 'Bio must be 200 characters or less' };
  }

  if (containsBadWords(bio)) {
    return { isValid: false, error: 'Bio contains inappropriate language' };
  }

  return { isValid: true };
}