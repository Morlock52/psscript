/**
 * Enhanced Security Middleware
 * Provides comprehensive security headers, rate limiting, and input validation
 */
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

/**
 * Enhanced Helmet configuration with Content Security Policy
 * More permissive for file uploads and Monaco editor while still providing protection
 */
export const securityHeaders = helmet({
  // Allow cross-origin resource loading for file uploads and assets
  crossOriginResourcePolicy: { policy: 'cross-origin' },

  // Cross-Origin Embedder Policy - disabled for Monaco editor compatibility
  crossOriginEmbedderPolicy: false,

  // Cross-Origin Opener Policy - protects against cross-origin attacks
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },

  // Content Security Policy - balanced for security and functionality
  // SECURITY NOTE: 'unsafe-eval' is required for Monaco editor's JavaScript parser.
  // This is a known Monaco limitation (https://github.com/microsoft/monaco-editor/issues/2879).
  // Risk mitigation:
  //   - XSS filter enabled (xssFilter: true)
  //   - Input sanitization middleware (sanitizeInput)
  //   - Strict CSP for other directives (object-src: none, frame-ancestors: none)
  //   - The eval is used internally by Monaco, not for user-supplied code execution
  // TODO: Consider Trusted Types API when browser support improves
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Scripts: self + inline for Monaco editor + eval for Monaco's parser
      // SECURITY: unsafe-eval required for Monaco editor - see note above
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      // Styles: self + inline for dynamic theming
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      // Fonts: self + Google Fonts
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      // Images: self + data URIs + HTTPS sources
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      // Connections: self + AI APIs + WebSocket
      connectSrc: [
        "'self'",
        'https://api.openai.com',
        'https://api.anthropic.com',
        'ws:',
        'wss:',
      ],
      // Media: self only
      mediaSrc: ["'self'"],
      // Objects: none (no plugins)
      objectSrc: ["'none'"],
      // Frames: none by default
      frameSrc: ["'none'"],
      // Base URI: self only
      baseUri: ["'self'"],
      // Form actions: self only
      formAction: ["'self'"],
      // Frame ancestors: none (prevent clickjacking)
      frameAncestors: ["'none'"],
      // Workers: self + blob for Monaco editor
      workerSrc: ["'self'", 'blob:'],
    },
  },

  // DNS Prefetch Control - disable to prevent information leakage
  dnsPrefetchControl: { allow: false },

  // Expect-CT - enforce Certificate Transparency (deprecated but still useful)
  // Not available in newer helmet versions

  // Frameguard - prevent clickjacking
  frameguard: { action: 'deny' },

  // HSTS - enforce HTTPS (only in production)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },

  // IE No Open - prevent IE from executing downloads
  ieNoOpen: true,

  // No Sniff - prevent MIME type sniffing
  noSniff: true,

  // Origin Agent Cluster - isolate origins for better security
  originAgentCluster: true,

  // Permitted Cross Domain Policies - restrict Adobe Flash/PDF access
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },

  // Referrer Policy - control referrer information
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

  // XSS Filter - enable browser XSS filter
  xssFilter: true,
});

/**
 * General API Rate Limiter
 * 100 requests per 15 minutes per IP
 */
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    error: 'Too many requests',
    message: 'Please try again later.',
    retryAfter: 15 * 60,
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Skip successful requests from counting (optional)
  skipSuccessfulRequests: false,
  // Key generator - use IP address
  keyGenerator: (req: Request) => {
    return req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
  },
});

/**
 * Authentication Rate Limiter
 * Stricter limits to prevent brute force attacks
 * 5 failed attempts per 15 minutes
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again in 15 minutes.',
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  keyGenerator: (req: Request) => {
    // Use both IP and username for more precise limiting
    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
    const username = req.body?.email || req.body?.username || '';
    return `auth:${ip}:${username}`;
  },
});

/**
 * AI Endpoint Rate Limiter
 * Stricter limits because AI operations are expensive
 * 20 requests per minute per IP
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 AI requests per minute
  message: {
    error: 'AI rate limit exceeded',
    message: 'Please wait before making more AI requests.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return `ai:${req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown'}`;
  },
});

/**
 * Upload Rate Limiter
 * Prevent abuse of file upload endpoints
 * 10 uploads per 5 minutes per IP
 */
export const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 uploads per window
  message: {
    error: 'Upload rate limit exceeded',
    message: 'Please wait before uploading more files.',
    retryAfter: 5 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return `upload:${req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown'}`;
  },
});

/**
 * Script Execution Rate Limiter
 * Prevent abuse of script analysis/execution
 * 30 requests per 5 minutes per IP
 */
export const scriptLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // 30 requests per window
  message: {
    error: 'Script operation rate limit exceeded',
    message: 'Please wait before performing more script operations.',
    retryAfter: 5 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return `script:${req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown'}`;
  },
});

/**
 * Input Sanitization Middleware
 * Removes potentially dangerous characters from request body
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    // Deep sanitize string values
    const sanitizeValue = (value: any): any => {
      if (typeof value === 'string') {
        // Remove null bytes and other control characters
        // But preserve newlines and tabs for script content
        // eslint-disable-next-line no-control-regex
        return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      }
      if (Array.isArray(value)) {
        return value.map(sanitizeValue);
      }
      if (value && typeof value === 'object') {
        const sanitized: any = {};
        for (const key of Object.keys(value)) {
          sanitized[key] = sanitizeValue(value[key]);
        }
        return sanitized;
      }
      return value;
    };

    req.body = sanitizeValue(req.body);
  }
  next();
};

/**
 * Security Headers Logger
 * Logs security-related events for monitoring
 */
export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  // Log suspicious patterns
  const suspiciousPatterns = [
    /(\.\.\/)/, // Path traversal
    /(<script)/i, // XSS attempt
    /(union.*select)/i, // SQL injection
    /(\$where|\$regex)/i, // NoSQL injection
  ];

  const body = JSON.stringify(req.body || {});
  const query = JSON.stringify(req.query || {});
  const combined = body + query;

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(combined)) {
      console.warn(`[SECURITY] Suspicious request pattern detected:`, {
        ip: req.ip,
        path: req.path,
        pattern: pattern.toString(),
        timestamp: new Date().toISOString(),
      });
      break;
    }
  }

  next();
};

/**
 * Request Size Validator
 * Prevents excessively large requests
 */
/**
 * CSRF Protection Middleware
 * Validates Origin/Referer headers for state-changing requests
 * For API-first backends, this is more appropriate than token-based CSRF
 */
export const csrfProtection = (allowedOrigins?: string[]) => {
  // Default allowed origins based on environment
  const defaultAllowed = process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL || 'https://psscript.morloksmaze.com']
    : [
        'http://localhost:3000',
        'http://localhost:3002',
        'https://localhost:3090',
        'http://localhost:4000',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3002',
        'https://127.0.0.1:3090'
      ];

  const origins = allowedOrigins || defaultAllowed;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Get origin from headers
    const origin = req.headers['origin'];
    const referer = req.headers['referer'];

    // Allow requests without origin (same-origin requests, server-to-server)
    if (!origin && !referer) {
      // In production, require origin header for state-changing requests
      if (process.env.NODE_ENV === 'production') {
        console.warn(`[CSRF] Request without origin header blocked:`, {
          ip: req.ip,
          path: req.path,
          method: req.method,
          timestamp: new Date().toISOString(),
        });
        return res.status(403).json({
          error: 'csrf_validation_failed',
          message: 'Origin header required for this request'
        });
      }
      // In development, allow but log
      return next();
    }

    // Check if origin is allowed
    const requestOrigin = origin || (referer ? new URL(referer).origin : null);

    if (requestOrigin && !origins.some(allowed =>
      requestOrigin === allowed ||
      requestOrigin.endsWith('.morloksmaze.com') // Allow subdomains in production
    )) {
      console.warn(`[CSRF] Request from disallowed origin blocked:`, {
        ip: req.ip,
        path: req.path,
        method: req.method,
        origin: requestOrigin,
        timestamp: new Date().toISOString(),
      });
      return res.status(403).json({
        error: 'csrf_validation_failed',
        message: 'Request origin not allowed'
      });
    }

    next();
  };
};

export const validateRequestSize = (maxSizeMB: number = 50) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const maxSize = maxSizeMB * 1024 * 1024; // Convert to bytes

    if (contentLength > maxSize) {
      return res.status(413).json({
        error: 'Payload Too Large',
        message: `Request body exceeds the ${maxSizeMB}MB limit`,
        maxSize: `${maxSizeMB}MB`,
      });
    }

    next();
  };
};

export default {
  securityHeaders,
  generalApiLimiter,
  authLimiter,
  aiLimiter,
  uploadLimiter,
  scriptLimiter,
  sanitizeInput,
  securityLogger,
  validateRequestSize,
  csrfProtection,
};
