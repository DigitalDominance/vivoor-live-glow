import { Filter } from 'bad-words';

// Create a bad words filter instance
const filter = new Filter();

// Add additional inappropriate words to the filter
const additionalWords = [
  // Common inappropriate terms that might not be in the default list
  'nazi', 'hitler', 'racist', 'hate', 'kill', 'die', 'suicide', 'rape',
  // Add more specific terms as needed
  'scam', 'fraud', 'ponzi', 'rugpull', 'spam'
];

additionalWords.forEach(word => filter.addWords(word));

/**
 * Checks if a text contains inappropriate language
 * @param text - The text to check
 * @returns true if the text contains bad words, false otherwise
 */
export function containsBadWords(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return filter.isProfane(text);
}

/**
 * Cleans inappropriate language from text
 * @param text - The text to clean
 * @returns The cleaned text with bad words replaced
 */
export function cleanText(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return filter.clean(text);
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