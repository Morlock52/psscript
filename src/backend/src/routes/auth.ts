import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User';
import { authenticateJWT, logAuthAttempt } from '../middleware/authMiddleware';
import logger from '../utils/logger';

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

const router = express.Router();

// Environment variables with better defaults and logging
const JWT_SECRET: Secret = process.env.JWT_SECRET || 'development_secret';
const JWT_EXPIRES_IN: string | number = process.env.JWT_EXPIRES_IN || '1d';
const REFRESH_TOKEN_SECRET: Secret = process.env.REFRESH_TOKEN_SECRET || 'development_refresh_secret';
const REFRESH_TOKEN_EXPIRES_IN: string | number = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

// Log JWT configuration on startup (without revealing secrets)
logger.info('Auth configuration loaded', {
  jwtExpiresIn: JWT_EXPIRES_IN,
  refreshTokenExpiresIn: REFRESH_TOKEN_EXPIRES_IN,
  usingDevSecrets: !process.env.JWT_SECRET || !process.env.REFRESH_TOKEN_SECRET
});

// Error response helper function
const sendErrorResponse = (
  res: Response, 
  status: number, 
  message: string, 
  errorCode: string,
  requestId?: string,
  details?: any
) => {
  const errorResponse = {
    success: false,
    message,
    error: errorCode,
    requestId,
    ...(details && { details })
  };
  
  return res.status(status).json(errorResponse);
};

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input
 *       409:
 *         description: User already exists
 */
router.post(
  '/register',
  logAuthAttempt,
  [
    body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('email').isEmail().withMessage('Must be a valid email address'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  async (req: Request, res: Response) => {
    const requestId = req.authInfo?.requestId;
    const startTime = Date.now();
    
    try {
      logger.debug('Processing registration request', {
        requestId,
        email: req.body.email,
        username: req.body.username
      });
      
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMsg = errors.array()[0].msg;
        logger.warn('Registration validation failed', {
          requestId,
          error: errorMsg,
          validationErrors: errors.array()
        });
        
        return sendErrorResponse(
          res, 
          400, 
          errorMsg, 
          'validation_error',
          requestId,
          { validationErrors: errors.array() }
        );
      }

      const { username, email, password } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        logger.warn('Registration failed: Email already exists', {
          requestId,
          email
        });
        
        return sendErrorResponse(
          res, 
          409, 
          'User with this email already exists', 
          'email_already_exists',
          requestId
        );
      }

      // Check if username is taken
      const existingUsername = await User.findOne({ where: { username } });
      if (existingUsername) {
        logger.warn('Registration failed: Username already taken', {
          requestId,
          username
        });
        
        return sendErrorResponse(
          res, 
          409, 
          'Username is already taken', 
          'username_already_exists',
          requestId
        );
      }

      // Create new user (password hashing is handled in the model hooks)
      const user = await User.create({
        username,
        email,
        password, // Will be hashed by the model hook
        role: 'user',
      });

      // Create JWT token
      const payload = { 
        userId: user.id, 
        username: user.username, 
        email: user.email, 
        role: user.role 
      };
      
      const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN as any
      });

      // Create refresh token
      const refreshPayload = { userId: user.id };
      const refreshToken = jwt.sign(refreshPayload, REFRESH_TOKEN_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRES_IN as any
      });

      // Return user data and token
      const processingTime = Date.now() - startTime;
      logger.info('User registered successfully', {
        requestId,
        userId: user.id,
        username,
        email,
        processingTime
      });
      
      res.status(201).json({
        success: true,
        token,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          created_at: user.createdAt,
        },
        requestId
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Registration error:', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime
      });
      
      return sendErrorResponse(
        res, 
        500, 
        'Server error during registration', 
        'server_error',
        requestId
      );
    }
  }
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid credentials
 *       404:
 *         description: User not found
 */
router.post(
  '/login',
  logAuthAttempt,
  [
    body('email').isEmail().withMessage('Must be a valid email address'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req: Request, res: Response) => {
    const requestId = req.authInfo?.requestId;
    const startTime = Date.now();
    const ipAddress = req.authInfo?.ipAddress || 'unknown';
    const userAgent = req.authInfo?.userAgent || 'unknown';
    
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMsg = errors.array()[0].msg;
        logger.warn('Login validation failed', {
          requestId,
          error: errorMsg,
          validationErrors: errors.array()
        });
        
        return sendErrorResponse(
          res, 
          400, 
          errorMsg, 
          'validation_error',
          requestId,
          { validationErrors: errors.array() }
        );
      }

      const { email, password } = req.body;

      logger.debug('Processing login request', {
        requestId,
        email,
        ipAddress,
        userAgent
      });

      // Find user
      const user = await User.findOne({ where: { email } });
      if (!user) {
        logger.warn('Login failed: User not found', {
          requestId,
          email,
          ipAddress
        });
        
        return sendErrorResponse(
          res, 
          404, 
          'User not found', 
          'user_not_found',
          requestId
        );
      }

      // Check password using the model's validatePassword method
      const isPasswordValid = await user.validatePassword(password, requestId);
      
      // Track login attempt
      await user.trackLoginAttempt(isPasswordValid, requestId);
      
      if (!isPasswordValid) {
        const loginAttempts = user.loginAttempts || 0;
        
        logger.warn('Login failed: Invalid credentials', {
          requestId,
          userId: user.id,
          email,
          ipAddress,
          loginAttempts,
          processingTime: Date.now() - startTime
        });
        
        // Add a delay for failed login attempts to prevent brute force
        const delayMs = Math.min(loginAttempts * 200, 2000);
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
        return sendErrorResponse(
          res, 
          400, 
          'Invalid credentials', 
          'invalid_credentials',
          requestId
        );
      }
      
      // Create JWT token
      const payload = { 
        userId: user.id, 
        username: user.username, 
        email: user.email, 
        role: user.role 
      };
      
      const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN as any
      });

      // Create refresh token
      const refreshPayload = { userId: user.id };
      const refreshToken = jwt.sign(refreshPayload, REFRESH_TOKEN_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRES_IN as any
      });

      const processingTime = Date.now() - startTime;
      logger.info('Login successful', {
        requestId,
        userId: user.id,
        username: user.username,
        email,
        ipAddress,
        processingTime
      });

      // Return user data and token
      res.json({
        success: true,
        token,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          created_at: user.createdAt,
          last_login_at: user.lastLoginAt,
        },
        requestId
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Login error:', {
        requestId,
        email: req.body?.email,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime
      });
      
      return sendErrorResponse(
        res, 
        500, 
        'Server error during login', 
        'server_error',
        requestId
      );
    }
  }
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New access token
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', logAuthAttempt, async (req: Request, res: Response) => {
  const requestId = req.authInfo?.requestId;
  const startTime = Date.now();
  
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      logger.warn('Token refresh failed: No refresh token provided', {
        requestId
      });
      
      return sendErrorResponse(
        res, 
        401, 
        'Refresh token is required', 
        'missing_refresh_token',
        requestId
      );
    }

    logger.debug('Processing token refresh request', {
      requestId
    });

    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as { userId: number };
      
      // Find user
      const user = await User.findByPk(decoded.userId);
      if (!user) {
        logger.warn('Token refresh failed: User not found', {
          requestId,
          userId: decoded.userId
        });
        
        return sendErrorResponse(
          res, 
          404, 
          'User not found', 
          'user_not_found',
          requestId
        );
      }

      // Create new JWT token
      const payload = { 
        userId: user.id, 
        username: user.username, 
        email: user.email, 
        role: user.role 
      };
      
      const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN as any
      });

      const processingTime = Date.now() - startTime;
      logger.info('Token refresh successful', {
        requestId,
        userId: user.id,
        username: user.username,
        processingTime
      });

      // Return new access token
      res.json({
        success: true,
        token,
        requestId
      });
    } catch (error) {
      // Handle specific JWT errors
      if (error instanceof jwt.TokenExpiredError) {
        logger.warn('Token refresh failed: Refresh token expired', {
          requestId,
          expiredAt: error.expiredAt
        });
        
        return sendErrorResponse(
          res, 
          401, 
          'Refresh token has expired', 
          'refresh_token_expired',
          requestId
        );
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.warn('Token refresh failed: Invalid refresh token', {
          requestId,
          error: error.message
        });
        
        return sendErrorResponse(
          res, 
          401, 
          'Invalid refresh token', 
          'invalid_refresh_token',
          requestId
        );
      }
      
      // Re-throw for the outer catch block
      throw error;
    }
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Token refresh error:', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTime
    });
    
    return sendErrorResponse(
      res, 
      401, 
      'Invalid refresh token', 
      'refresh_token_error',
      requestId
    );
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user information
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information
 *       401:
 *         description: Not authenticated
 */
router.get('/me', authenticateJWT, async (req: Request, res: Response) => {
  const requestId = req.authInfo?.requestId;
  const startTime = Date.now();
  
  try {
    logger.debug('Processing get user info request', {
      requestId,
      userId: req.user.id
    });
    
    // req.user is set by authMiddleware
    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      logger.warn('Get user info failed: User not found', {
        requestId,
        userId: req.user.id
      });
      
      return sendErrorResponse(
        res, 
        404, 
        'User not found', 
        'user_not_found',
        requestId
      );
    }

    const processingTime = Date.now() - startTime;
    logger.debug('Get user info successful', {
      requestId,
      userId: user.id,
      username: user.username,
      processingTime
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        created_at: user.createdAt,
        last_login_at: user.lastLoginAt,
      },
      requestId
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Get user info error:', {
      requestId,
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTime
    });
    
    return sendErrorResponse(
      res, 
      500, 
      'Server error', 
      'server_error',
      requestId
    );
  }
});

/**
 * @swagger
 * /api/auth/user:
 *   put:
 *     summary: Update user information
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               avatar_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *       401:
 *         description: Not authenticated
 */
router.put('/user', authenticateJWT, async (req: Request, res: Response) => {
  const requestId = req.authInfo?.requestId;
  const startTime = Date.now();
  
  try {
    logger.debug('Processing update user request', {
      requestId,
      userId: req.user.id
    });
    
    const { username, email, avatar_url } = req.body;
    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      logger.warn('Update user failed: User not found', {
        requestId,
        userId: req.user.id
      });
      
      return sendErrorResponse(
        res, 
        404, 
        'User not found', 
        'user_not_found',
        requestId
      );
    }

    // Check if username is taken (if changing username)
    if (username && username !== user.username) {
      const existingUsername = await User.findOne({ where: { username } });
      if (existingUsername) {
        logger.warn('Update user failed: Username already taken', {
          requestId,
          userId: req.user.id,
          username
        });
        
        return sendErrorResponse(
          res, 
          409, 
          'Username is already taken', 
          'username_already_exists',
          requestId
        );
      }
      user.username = username;
    }

    // Check if email is taken (if changing email)
    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) {
        logger.warn('Update user failed: Email already in use', {
          requestId,
          userId: req.user.id,
          email
        });
        
        return sendErrorResponse(
          res, 
          409, 
          'Email is already in use', 
          'email_already_exists',
          requestId
        );
      }
      user.email = email;
    }

    // Avatar URL not supported in current model
    // Uncomment if you add avatarUrl to the User model
    // if (avatar_url) {
    //   user.avatarUrl = avatar_url;
    // }

    await user.save();

    const processingTime = Date.now() - startTime;
    logger.info('User updated successfully', {
      requestId,
      userId: user.id,
      username: user.username,
      email: user.email,
      processingTime
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        created_at: user.createdAt,
        last_login_at: user.lastLoginAt,
      },
      requestId
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Update user error:', {
      requestId,
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTime
    });
    
    return sendErrorResponse(
      res, 
      500, 
      'Server error during update', 
      'server_error',
      requestId
    );
  }
});

export default router;
