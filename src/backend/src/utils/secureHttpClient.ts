/**
 * Secure HTTP Client Utilities
 *
 * Provides SSL/TLS certificate validation enforcement.
 * NEVER disable certificate validation in production - this opens the door
 * to man-in-the-middle attacks.
 *
 * @see https://nodejs.org/api/tls.html
 * @see https://httptoolkit.com/blog/node-https-vulnerability/
 */
import https from 'https';
import axios, { AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults } from 'axios';
import logger from './logger';

/**
 * Environment check for production mode
 */
const isProduction = process.env.NODE_ENV === 'production';

/**
 * CRITICAL SECURITY: Default HTTPS agent with certificate validation enforced
 *
 * This agent ALWAYS validates certificates:
 * - rejectUnauthorized: true (DEFAULT and REQUIRED for security)
 * - In production, this MUST NEVER be changed to false
 *
 * For custom CAs (e.g., corporate proxies), use NODE_EXTRA_CA_CERTS environment variable
 * instead of disabling validation.
 *
 * @example
 * // Set custom CA bundle via environment variable:
 * // NODE_EXTRA_CA_CERTS=/path/to/ca-bundle.pem node app.js
 */
export const secureHttpsAgent = new https.Agent({
  // SECURITY: Always validate SSL/TLS certificates
  rejectUnauthorized: true,
  // Minimum TLS version (TLS 1.2+)
  minVersion: 'TLSv1.2',
  // Keep connections alive for performance
  keepAlive: true,
  // Connection pooling
  maxSockets: 50,
  maxFreeSockets: 10,
});

/**
 * Create a secure axios instance with enforced certificate validation
 *
 * @param config - Additional axios configuration
 * @returns Secure axios instance
 *
 * @example
 * const client = createSecureClient({ baseURL: 'https://api.example.com' });
 * const response = await client.get('/data');
 */
export function createSecureClient(config?: CreateAxiosDefaults): AxiosInstance {
  const client = axios.create({
    ...config,
    httpsAgent: secureHttpsAgent,
    // Additional security settings
    timeout: config?.timeout || 30000, // 30 second default timeout
    maxRedirects: 5,
  });

  // Add request interceptor for logging and security checks
  client.interceptors.request.use(
    (requestConfig) => {
      // Log outgoing requests in debug mode
      if (process.env.DEBUG_HTTP === 'true') {
        logger.debug(`[HTTP] ${requestConfig.method?.toUpperCase()} ${requestConfig.url}`);
      }
      return requestConfig;
    },
    (error) => {
      logger.error('[HTTP] Request error:', error.message);
      return Promise.reject(error);
    }
  );

  // Add response interceptor for error handling
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      // Log SSL/TLS errors specifically
      if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
          error.code === 'CERT_HAS_EXPIRED' ||
          error.code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
          error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
        logger.error('[SECURITY] SSL/TLS certificate validation failed:', {
          code: error.code,
          message: error.message,
          url: error.config?.url,
        });
        // In production, always reject invalid certificates
        if (isProduction) {
          throw new Error(`SSL certificate validation failed: ${error.code}. This connection is not secure.`);
        }
      }
      return Promise.reject(error);
    }
  );

  return client;
}

/**
 * Validate that a URL uses HTTPS in production
 *
 * @param url - URL to validate
 * @throws Error if URL is not HTTPS in production
 *
 * @example
 * validateHttpsUrl('http://example.com'); // Throws in production
 * validateHttpsUrl('https://example.com'); // OK
 */
export function validateHttpsUrl(url: string): void {
  if (isProduction && url.startsWith('http://')) {
    throw new Error(
      `Insecure HTTP URL detected in production: ${url}. Use HTTPS instead.`
    );
  }
}

/**
 * Secure fetch wrapper that enforces certificate validation
 *
 * @param url - URL to fetch
 * @param options - Request options
 * @returns Response data
 */
export async function secureFetch<T = unknown>(
  url: string,
  options?: AxiosRequestConfig
): Promise<T> {
  validateHttpsUrl(url);

  const client = createSecureClient();
  const response = await client.request<T>({
    url,
    ...options,
  });

  return response.data;
}

/**
 * Check if the current environment has proper TLS configuration
 * Run this at startup to catch configuration issues early
 */
export function validateTlsConfiguration(): void {
  // Check for dangerous environment variables
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    const message = 'CRITICAL SECURITY WARNING: NODE_TLS_REJECT_UNAUTHORIZED=0 is set. ' +
      'This disables all SSL/TLS certificate validation and exposes the application ' +
      'to man-in-the-middle attacks.';

    if (isProduction) {
      logger.error('[SECURITY] ' + message);
      throw new Error('Production deployment with NODE_TLS_REJECT_UNAUTHORIZED=0 is not allowed.');
    } else {
      logger.warn('[SECURITY] ' + message);
    }
  }

  // Check for custom CA certificates
  if (process.env.NODE_EXTRA_CA_CERTS) {
    logger.info(`[TLS] Using custom CA certificates from: ${process.env.NODE_EXTRA_CA_CERTS}`);
  }

  logger.info('[TLS] SSL/TLS certificate validation is ENABLED');
}

/**
 * Wrapper to safely configure axios instances created elsewhere
 * Call this to patch an existing axios instance to use secure settings
 *
 * @param instance - Existing axios instance to secure
 */
export function enforceSecureDefaults(instance: AxiosInstance): void {
  // Override the https agent
  instance.defaults.httpsAgent = secureHttpsAgent;

  // Add security interceptor
  instance.interceptors.request.use((config) => {
    // Ensure we're not accidentally using an insecure agent
    if (config.httpsAgent) {
      const agent = config.httpsAgent as https.Agent;
      // Check if rejectUnauthorized has been set to false
      if (agent.options && agent.options.rejectUnauthorized === false) {
        logger.warn('[SECURITY] Detected httpsAgent with rejectUnauthorized: false');
        if (isProduction) {
          throw new Error('Cannot use insecure HTTPS agent in production');
        }
      }
    }
    return config;
  });
}

/**
 * Create a diagnostic report of TLS configuration
 * Useful for debugging SSL issues
 */
export function getTlsDiagnostics(): Record<string, unknown> {
  return {
    nodeVersion: process.version,
    opensslVersion: process.versions.openssl,
    nodeTlsRejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED || 'not set',
    nodeExtraCaCerts: process.env.NODE_EXTRA_CA_CERTS || 'not set',
    isProduction,
    secureAgentOptions: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
    },
  };
}

// Export default secure client instance
export default createSecureClient();
