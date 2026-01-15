/**
 * Password Strength Validation
 *
 * Implements OWASP password guidelines for 2025:
 * - Minimum length of 12 characters (NIST SP 800-63B recommends 8+, we go higher)
 * - Maximum length of 128 characters (prevent DoS via long password hashing)
 * - Character diversity requirements
 * - Common password checking
 * - No personal info matching
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 */

import { IS_PRODUCTION } from './envValidation';

// Password requirements (exported for use in validation messages)
export const MIN_PASSWORD_LENGTH = IS_PRODUCTION ? 12 : 8; // Stricter in production
export const MAX_PASSWORD_LENGTH = 128;
const MIN_CHARACTER_CLASSES = IS_PRODUCTION ? 3 : 2; // Stricter in production

// Common passwords that should be rejected (partial list - in production, use a larger list)
const COMMON_PASSWORDS = new Set([
  'password', 'password123', 'password1', '123456', '12345678', '123456789',
  'qwerty', 'qwerty123', 'abc123', 'letmein', 'welcome', 'admin', 'admin123',
  'login', 'master', 'hello', 'freedom', 'whatever', 'shadow', 'sunshine',
  'princess', 'dragon', 'football', 'baseball', 'monkey', 'iloveyou',
  'trustno1', 'batman', 'starwars', 'superman', '123123', '654321',
  '111111', '000000', 'access', 'password!', 'p@ssword', 'p@ssw0rd',
  'passw0rd', 'pass@123', 'test', 'test123', 'demo', 'demo123',
  'guest', 'guest123', 'changeme', 'secret', 'secret123'
]);

// Sequential and repeated patterns to reject
const WEAK_PATTERNS = [
  /^(.)\1+$/,                           // All same character: aaaaaaa
  /^(012|123|234|345|456|567|678|789)+$/, // Sequential numbers
  /^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)+$/i, // Sequential letters
  /^(qwe|wer|ert|rty|tyu|yui|uio|iop|asd|sdf|dfg|fgh|ghj|hjk|jkl|zxc|xcv|cvb|vbn|bnm)+$/i, // Keyboard patterns
];

export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0-100
  errors: string[];
  suggestions: string[];
}

/**
 * Calculate character class diversity
 */
function getCharacterClasses(password: string): {
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
  count: number;
} {
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  return {
    hasLowercase,
    hasUppercase,
    hasDigit,
    hasSpecial,
    count: [hasLowercase, hasUppercase, hasDigit, hasSpecial].filter(Boolean).length
  };
}

/**
 * Check if password contains personal information
 */
function containsPersonalInfo(password: string, userInfo?: { username?: string; email?: string }): boolean {
  if (!userInfo) return false;

  const pwLower = password.toLowerCase();

  if (userInfo.username && pwLower.includes(userInfo.username.toLowerCase())) {
    return true;
  }

  if (userInfo.email) {
    const emailLocal = userInfo.email.split('@')[0].toLowerCase();
    if (pwLower.includes(emailLocal)) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate password entropy (bits)
 */
function calculateEntropy(password: string): number {
  const classes = getCharacterClasses(password);
  let poolSize = 0;

  if (classes.hasLowercase) poolSize += 26;
  if (classes.hasUppercase) poolSize += 26;
  if (classes.hasDigit) poolSize += 10;
  if (classes.hasSpecial) poolSize += 32; // Approximation for common special chars

  if (poolSize === 0) return 0;

  return Math.floor(password.length * Math.log2(poolSize));
}

/**
 * Calculate password strength score (0-100)
 */
function calculateStrengthScore(password: string): number {
  let score = 0;

  // Length contribution (up to 40 points)
  score += Math.min(40, password.length * 3);

  // Character diversity (up to 30 points)
  const classes = getCharacterClasses(password);
  score += classes.count * 7.5;

  // Entropy bonus (up to 20 points)
  const entropy = calculateEntropy(password);
  score += Math.min(20, entropy / 4);

  // Penalty for common patterns
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    score -= 50;
  }

  for (const pattern of WEAK_PATTERNS) {
    if (pattern.test(password)) {
      score -= 20;
      break;
    }
  }

  // Penalty for repeated characters
  const uniqueChars = new Set(password).size;
  if (uniqueChars < password.length * 0.5) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Validate password strength
 *
 * @param password - The password to validate
 * @param userInfo - Optional user info to check for personal data in password
 * @returns Validation result with score and feedback
 */
export function validatePasswordStrength(
  password: string,
  userInfo?: { username?: string; email?: string }
): PasswordValidationResult {
  const errors: string[] = [];
  const suggestions: string[] = [];

  // Check if password is provided
  if (!password) {
    return {
      isValid: false,
      score: 0,
      errors: ['Password is required'],
      suggestions: ['Please provide a password']
    };
  }

  // Check minimum length
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
    suggestions.push('Add more characters to increase security');
  }

  // Check maximum length (prevent DoS)
  if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Password cannot exceed ${MAX_PASSWORD_LENGTH} characters`);
  }

  // Check character diversity
  const classes = getCharacterClasses(password);
  if (classes.count < MIN_CHARACTER_CLASSES) {
    errors.push(`Password must contain at least ${MIN_CHARACTER_CLASSES} character types`);
    if (!classes.hasLowercase) suggestions.push('Add lowercase letters (a-z)');
    if (!classes.hasUppercase) suggestions.push('Add uppercase letters (A-Z)');
    if (!classes.hasDigit) suggestions.push('Add numbers (0-9)');
    if (!classes.hasSpecial) suggestions.push('Add special characters (!@#$%^&*)');
  }

  // Check for common passwords
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('This password is too common and easily guessable');
    suggestions.push('Choose a more unique password');
  }

  // Check for weak patterns
  for (const pattern of WEAK_PATTERNS) {
    if (pattern.test(password)) {
      errors.push('Password contains predictable patterns');
      suggestions.push('Avoid sequential characters, repeated patterns, or keyboard walks');
      break;
    }
  }

  // Check for personal information
  if (containsPersonalInfo(password, userInfo)) {
    errors.push('Password should not contain your username or email');
    suggestions.push('Choose a password that does not include personal information');
  }

  // Calculate strength score
  const score = calculateStrengthScore(password);

  // Add suggestions based on score
  if (score < 50 && errors.length === 0) {
    suggestions.push('Consider using a longer password or adding more character types');
  }

  if (score >= 80 && errors.length === 0) {
    suggestions.push('Strong password!');
  }

  return {
    isValid: errors.length === 0,
    score,
    errors,
    suggestions
  };
}

/**
 * Express validator custom validation function
 */
export const passwordStrengthValidator = (value: string, { req }: any) => {
  const result = validatePasswordStrength(value, {
    username: req.body?.username,
    email: req.body?.email
  });

  if (!result.isValid) {
    throw new Error(result.errors[0]);
  }

  return true;
};

export default {
  validatePasswordStrength,
  passwordStrengthValidator,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH
};
