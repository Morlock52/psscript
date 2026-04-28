/**
 * Environment Variable Validation
 *
 * Validates required environment variables at application startup.
 * Fails fast in production if critical variables are missing.
 *
 * @see https://www.nodejs-security.com/blog/owasp-nodejs-authentication-authorization-cryptography-practices
 */

import crypto from 'crypto';

// Environment detection
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
export const IS_TEST = process.env.NODE_ENV === 'test';

// Minimum entropy requirements for secrets (in bytes)
const MIN_SECRET_LENGTH = 32;
const _MIN_SECRET_ENTROPY_BITS = 128; // Reserved for future entropy validation

/**
 * Required environment variables by category
 */
const REQUIRED_VARS = {
  database: ['DATABASE_URL'],
  auth: ['JWT_SECRET', 'REFRESH_TOKEN_SECRET'],
  production: ['BCRYPT_ROUNDS'],
};

/**
 * Supabase and other managed Postgres providers commonly encode SSL in DATABASE_URL.
 */
export function databaseUrlRequestsSSL(databaseUrl = process.env.DATABASE_URL): boolean {
  if (!databaseUrl) {
    return false;
  }

  try {
    const url = new URL(databaseUrl);
    const sslMode = url.searchParams.get('sslmode')?.toLowerCase();
    const ssl = url.searchParams.get('ssl')?.toLowerCase();
    const host = url.hostname.toLowerCase();
    const requiresSsl = sslMode
      ? ['require', 'verify-ca', 'verify-full'].includes(sslMode)
      : false;

    return (
      requiresSsl ||
      ssl === 'true' ||
      ssl === '1' ||
      host.endsWith('.supabase.co') ||
      host.endsWith('.pooler.supabase.com')
    );
  } catch (_error) {
    return false;
  }
}

export function databaseSslEnabled(databaseUrl = process.env.DATABASE_URL): boolean {
  return process.env.DB_SSL === 'true' || databaseUrlRequestsSSL(databaseUrl);
}

/**
 * Obfuscate sensitive values for logging
 */
export function obfuscateSecret(value: string): string {
  if (!value || value.length < 8) return '***';
  return `${value.slice(0, 4)}...${value.slice(-4)} (${value.length} chars)`;
}

/**
 * Obfuscate email for logging (GDPR compliance)
 */
export function obfuscateEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***';
  const [local, domain] = email.split('@');
  const hiddenLocal = local.length <= 2
    ? '*'.repeat(local.length)
    : `${local.slice(0, 2)}${'*'.repeat(Math.max(0, local.length - 4))}${local.slice(-2)}`;
  return `${hiddenLocal}@${domain}`;
}

/**
 * Check if a secret has sufficient entropy
 */
function hasMinimumEntropy(secret: string): boolean {
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    return false;
  }

  // Check for common weak patterns
  const weakPatterns = [
    /^(.)\1+$/,                    // All same character
    /^(12345|password|secret|admin|development)/i,  // Common weak prefixes
    /^[a-z]+$/i,                   // Only letters
    /^[0-9]+$/,                    // Only numbers
  ];

  for (const pattern of weakPatterns) {
    if (pattern.test(secret)) {
      return false;
    }
  }

  // Check character diversity
  const hasUpper = /[A-Z]/.test(secret);
  const hasLower = /[a-z]/.test(secret);
  const hasDigit = /[0-9]/.test(secret);
  const hasSpecial = /[^A-Za-z0-9]/.test(secret);

  const diversityScore = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;

  return diversityScore >= 3; // At least 3 character classes
}

/**
 * Generate a secure random secret
 */
export function generateSecureSecret(length: number = 64): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Validation result interface
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate all required environment variables
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('\n🔐 Validating environment configuration...\n');

  // Check database variables. DATABASE_URL is preferred for hosted Postgres/Supabase.
  if (process.env.DATABASE_URL) {
    try {
      new URL(process.env.DATABASE_URL);
    } catch (_error) {
      errors.push('DATABASE_URL is not a valid URL');
    }
  } else {
    for (const varName of REQUIRED_VARS.database) {
      if (!process.env[varName]) {
        if (IS_PRODUCTION) {
          errors.push(`Missing required database variable: ${varName}`);
        } else {
          warnings.push(`Missing database variable: ${varName} (using default)`);
        }
      }
    }
  }

  // Check auth variables
  for (const varName of REQUIRED_VARS.auth) {
    const value = process.env[varName];

    if (!value) {
      if (IS_PRODUCTION) {
        errors.push(`CRITICAL: Missing ${varName} - cannot start in production`);
      } else {
        warnings.push(`Missing ${varName} - using insecure development default`);
      }
      continue;
    }

    // Check entropy in production
    if (IS_PRODUCTION && !hasMinimumEntropy(value)) {
      errors.push(
        `${varName} has insufficient entropy. ` +
        `Minimum ${MIN_SECRET_LENGTH} chars with mixed character classes required. ` +
        `Generate with: openssl rand -hex 32`
      );
    } else if (!hasMinimumEntropy(value)) {
      warnings.push(`${varName} has weak entropy (acceptable for development only)`);
    }
  }

  // Production-specific checks
  if (IS_PRODUCTION) {
    // Require SSL. DATABASE_URL?sslmode=require is accepted for Supabase pooler URLs.
    if (!databaseSslEnabled()) {
      errors.push('DB_SSL must be "true" or DATABASE_URL must request SSL in production');
    }

    // Check bcrypt rounds
    const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
    if (bcryptRounds < 12) {
      warnings.push(`BCRYPT_ROUNDS=${bcryptRounds} is below recommended minimum of 12 for production`);
    }

    // Ensure no development secrets
    if (process.env.JWT_SECRET?.includes('development') ||
        process.env.JWT_SECRET?.includes('secret') ||
        process.env.JWT_SECRET?.includes('INSECURE')) {
      errors.push('JWT_SECRET contains development/insecure keywords - not allowed in production');
    }

    // Check for debug mode
    if (process.env.DEBUG === 'true' || process.env.LOG_LEVEL === 'debug') {
      warnings.push('Debug logging is enabled in production - may expose sensitive data');
    }
  }

  // Log results
  if (errors.length > 0) {
    console.error('❌ Environment validation FAILED:\n');
    errors.forEach(err => console.error(`   • ${err}`));
    console.error('');
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Environment warnings:\n');
    warnings.forEach(warn => console.warn(`   • ${warn}`));
    console.warn('');
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ Environment validation passed\n');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate and fail fast if environment is invalid
 * Call this at application startup
 */
export function requireValidEnvironment(): void {
  const result = validateEnvironment();

  if (!result.isValid) {
    if (IS_PRODUCTION) {
      console.error('\n🛑 FATAL: Cannot start application with invalid environment in production\n');
      process.exit(1);
    } else {
      console.warn('\n⚠️  Starting with invalid environment (development mode only)\n');
    }
  }
}

/**
 * Get configuration with validated secrets
 */
export function getAuthConfig() {
  const jwtSecret = process.env.JWT_SECRET;
  const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;

  // In production, require valid secrets
  if (IS_PRODUCTION) {
    if (!jwtSecret || !refreshTokenSecret) {
      throw new Error('JWT_SECRET and REFRESH_TOKEN_SECRET are required in production');
    }
    return {
      jwtSecret,
      refreshTokenSecret,
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
      refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
      accountLockoutAttempts: parseInt(process.env.ACCOUNT_LOCKOUT_ATTEMPTS || '5'),
      accountLockoutDurationMinutes: parseInt(process.env.ACCOUNT_LOCKOUT_DURATION || '30'),
    };
  }

  // Development fallbacks with warnings
  return {
    jwtSecret: jwtSecret || 'DEVELOPMENT_SECRET_DO_NOT_USE_IN_PRODUCTION',
    refreshTokenSecret: refreshTokenSecret || 'DEVELOPMENT_REFRESH_SECRET_DO_NOT_USE_IN_PRODUCTION',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
    accountLockoutAttempts: parseInt(process.env.ACCOUNT_LOCKOUT_ATTEMPTS || '5'),
    accountLockoutDurationMinutes: parseInt(process.env.ACCOUNT_LOCKOUT_DURATION || '30'),
  };
}

/**
 * Get database configuration
 */
export function getDbConfig() {
  const useSSL = databaseSslEnabled();
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    try {
      const parsed = new URL(databaseUrl);
      return {
        host: parsed.hostname,
        port: parseInt(parsed.port || '5432'),
        database: parsed.pathname ? parsed.pathname.replace(/^\//, '') : 'postgres',
        username: parsed.username || 'postgres',
        password: parsed.password || '',
        ssl: true,
        rejectUnauthorized: IS_PRODUCTION ? true : false,
      };
    } catch (_error) {
      // Fall through to validation error surface below.
    }
  }

  return {
    host: 'DATABASE_URL required',
    port: 5432,
    database: 'postgres',
    username: 'postgres',
    password: '',
    ssl: useSSL,
    // In production, require certificate validation
    rejectUnauthorized: IS_PRODUCTION ? true : false,
  };
}

export default {
  validateEnvironment,
  requireValidEnvironment,
  getAuthConfig,
  getDbConfig,
  obfuscateSecret,
  obfuscateEmail,
  generateSecureSecret,
  databaseUrlRequestsSSL,
  databaseSslEnabled,
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  IS_TEST,
};
