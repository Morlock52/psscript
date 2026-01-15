import { Request, Response, NextFunction } from 'express';
import jwt, { JsonWebTokenError, TokenExpiredError, NotBeforeError } from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models';
import logger from '../utils/logger';
import { getAuthConfig, IS_PRODUCTION } from '../utils/envValidation';

// Extend the Express Request interface to include user and auth info
declare module 'express' {
  interface Request {
    user?: any;
    authInfo?: {
      tokenType: string;
      requestId: string;
      timestamp: number;
      ipAddress: string;
      userAgent: string;
    };
  }
}

/**
 * Generate a cryptographically secure request ID for tracking auth requests
 */
const generateRequestId = (): string => {
  return `auth-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
};

/**
 * Get client IP address from request
 */
const getClientIp = (req: Request): string => {
  return (
    req.headers['x-forwarded-for'] as string ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

/**
 * Middleware to authenticate JWT tokens
 * Adds the user information to the request object if authenticated
 */
export const authenticateJWT = async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const ipAddress = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  // Add auth info to request for logging purposes
  req.authInfo = {
    tokenType: 'none',
    requestId,
    timestamp: startTime,
    ipAddress,
    userAgent
  };
  
  logger.debug('Authentication attempt', {
    requestId,
    path: req.path,
    method: req.method,
    ipAddress,
    userAgent
  });

  // Get token from Authorization header or query parameter (for SSE)
  let token: string | undefined;
  const authHeader = req.headers.authorization;

  if (authHeader) {
    // Extract token from Authorization header (remove "Bearer " prefix)
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    // For SSE which doesn't support custom headers, get token from query param
    token = req.query.token as string;
    logger.debug('Using token from query parameter for SSE', { requestId });
  }

  if (!token) {
    logger.warn('Authentication failed: No token provided', {
      requestId,
      path: req.path,
      method: req.method
    });
    return res.status(401).json({
      message: 'Access denied. No token provided.',
      error: 'missing_token',
      requestId
    });
  }
  
  // Update auth info with token type
  req.authInfo.tokenType = 'jwt';

  // SECURITY: Demo tokens have been removed entirely
  // They were a security risk even in development mode because:
  // 1. They bypass real authentication
  // 2. Environment variables can be misconfigured
  // 3. They create patterns of insecure authentication
  if (token.startsWith('demo-token-')) {
    logger.warn('Demo token authentication rejected - feature removed for security', {
      requestId,
      path: req.path,
      ipAddress,
      environment: process.env.NODE_ENV
    });
    return res.status(401).json({
      error: 'Demo tokens are no longer supported. Please use real authentication.',
      message: 'Use proper JWT authentication. Create a user account and login.',
      requestId
    });
  }

  try {
    // Get JWT secret from validated environment configuration
    const authConfig = getAuthConfig();
    const secret = authConfig.jwtSecret;

    logger.debug('Verifying JWT token', {
      requestId,
      isProduction: IS_PRODUCTION
    });

    const decoded: any = jwt.verify(token, secret);

    // Get user from database
    logger.debug('JWT verified, fetching user', { 
      requestId,
      userId: decoded.userId
    });
    
    const user = await User.findByPk(decoded.userId);
    
    if (!user) {
      logger.warn('Authentication failed: User not found', {
        requestId,
        userId: decoded.userId
      });
      return res.status(401).json({ 
        message: 'User not found.',
        error: 'user_not_found',
        requestId
      });
    }
    
    // Add user information to request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };
    
    const processingTime = Date.now() - startTime;
    logger.debug('Authentication successful', {
      requestId,
      processingTime,
      user: user.username,
      userId: user.id
    });
    
    next();
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Categorize JWT errors for better debugging
    let errorType = 'unknown_token_error';
    let errorMessage = 'Invalid token.';
    
    if (error instanceof TokenExpiredError) {
      errorType = 'token_expired';
      errorMessage = 'Token has expired.';
      logger.warn('Authentication failed: Token expired', {
        requestId,
        expiredAt: error.expiredAt,
        processingTime
      });
    } else if (error instanceof JsonWebTokenError) {
      errorType = 'invalid_token';
      errorMessage = 'Invalid token.';
      logger.warn('Authentication failed: Invalid token', {
        requestId,
        jwtError: error.message,
        processingTime
      });
    } else if (error instanceof NotBeforeError) {
      errorType = 'token_not_active';
      errorMessage = 'Token not yet active.';
      logger.warn('Authentication failed: Token not active yet', {
        requestId,
        notBefore: error.date,
        processingTime
      });
    } else {
      logger.error('JWT verification error:', {
        requestId,
        error,
        processingTime
      });
    }
    
    return res.status(401).json({ 
      message: errorMessage,
      error: errorType,
      requestId
    });
  }
};

/**
 * Middleware to check if user has admin role
 * Must be used after authenticateJWT
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.authInfo?.requestId || generateRequestId();
  
  if (!req.user) {
    logger.warn('Admin access denied: Not authenticated', {
      requestId,
      path: req.path,
      method: req.method
    });
    return res.status(401).json({ 
      message: 'Authentication required.',
      error: 'authentication_required',
      requestId
    });
  }
  
  if (req.user.role !== 'admin') {
    logger.warn('Admin access denied: Insufficient privileges', {
      requestId,
      path: req.path,
      method: req.method,
      userRole: req.user.role,
      userId: req.user.id
    });
    return res.status(403).json({ 
      message: 'Access denied. Admin privileges required.',
      error: 'insufficient_privileges',
      requestId
    });
  }
  
  logger.debug('Admin access granted', {
    requestId,
    path: req.path,
    userId: req.user.id
  });
  
  next();
};

/**
 * Optional JWT authentication
 * Adds user information to request if token is valid, but continues if no token or invalid token
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  // Add auth info to request for logging purposes
  req.authInfo = {
    tokenType: 'none',
    requestId,
    timestamp: startTime,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] || 'unknown'
  };
  
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  
  // If no header, continue without authentication
  if (!authHeader) {
    logger.debug('Optional auth: No authorization header', {
      requestId,
      path: req.path
    });
    return next();
  }
  
  // Extract token (remove "Bearer " prefix)
  const token = authHeader.split(' ')[1];
  
  // If no token, continue without authentication
  if (!token) {
    logger.debug('Optional auth: No token in authorization header', {
      requestId,
      path: req.path
    });
    return next();
  }
  
  // Update auth info with token type
  req.authInfo.tokenType = token.startsWith('demo-token-') ? 'demo' : 'jwt';
  
  try {
    // Verify token
    // SECURITY: Use same secret logic as main auth
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret && IS_PRODUCTION) {
      logger.error('CRITICAL: JWT_SECRET not set in production', { requestId });
      return next(); // Continue without auth in optional middleware
    }
    const secret = jwtSecret || 'development_secret_INSECURE';
    const decoded: any = jwt.verify(token, secret);

    // Get user from database
    const user = await User.findByPk(decoded.userId);
    
    if (user) {
      // Add user information to request
      req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      };
      
      logger.debug('Optional auth: User authenticated', {
        requestId,
        path: req.path,
        userId: user.id,
        processingTime: Date.now() - startTime
      });
    } else {
      logger.debug('Optional auth: User not found', {
        requestId,
        path: req.path,
        decodedUserId: decoded.userId
      });
    }
    
    next();
  } catch (error) {
    // If token verification fails, continue without user info
    logger.debug('Optional auth: Token verification failed', {
      requestId,
      path: req.path,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next();
  }
};

/**
 * Create a middleware that logs authentication attempts
 */
export const logAuthAttempt = (req: Request, res: Response, next: NextFunction) => {
  const requestId = generateRequestId();
  const ipAddress = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  logger.info('Auth endpoint accessed', {
    requestId,
    path: req.path,
    method: req.method,
    ipAddress,
    userAgent
  });
  
  // Add request ID to response headers for debugging
  res.setHeader('X-Request-ID', requestId);
  
  next();
};
