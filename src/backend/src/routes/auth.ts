import '../types/express';
import express, { Request, Response } from 'express';
import jwt, { Secret } from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User';
import { authenticateJWT, logAuthAttempt } from '../middleware/authMiddleware';
import logger from '../utils/logger';
import { getAuthConfig, IS_PRODUCTION, obfuscateEmail } from '../utils/envValidation';
import { passwordStrengthValidator, MIN_PASSWORD_LENGTH } from '../utils/passwordValidation';
import bcrypt from 'bcrypt';

const router = express.Router();

const getRequestUser = (req: Request) => (req as any).user;
const getAuthInfo = (req: Request) => (req as any).authInfo;

// Get configuration from validated environment
const authConfig = getAuthConfig();
const JWT_SECRET: Secret = authConfig.jwtSecret;
const JWT_EXPIRES_IN: string | number = authConfig.jwtExpiresIn;
const REFRESH_TOKEN_SECRET: Secret = authConfig.refreshTokenSecret;
const REFRESH_TOKEN_EXPIRES_IN: string | number = authConfig.refreshTokenExpiresIn;

// Log JWT configuration on startup (without revealing secrets)
logger.info('Auth configuration loaded', {
  jwtExpiresIn: JWT_EXPIRES_IN,
  refreshTokenExpiresIn: REFRESH_TOKEN_EXPIRES_IN,
  isProduction: IS_PRODUCTION,
  bcryptRounds: authConfig.bcryptRounds,
  accountLockoutAttempts: authConfig.accountLockoutAttempts,
  accountLockoutDurationMinutes: authConfig.accountLockoutDurationMinutes
});

// Constant-time delay to prevent timing attacks on login
const CONSTANT_LOGIN_DELAY_MS = 100;

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
    body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Must be a valid email address'),
    body('password')
      .isLength({ min: MIN_PASSWORD_LENGTH })
      .withMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      .custom(passwordStrengthValidator),
  ],
  async (req: Request, res: Response) => {
    const requestId = getAuthInfo(req)?.requestId;
    const startTime = Date.now();

    try {
      logger.debug('Processing registration request', {
        requestId,
        email: obfuscateEmail(req.body.email),
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
    const requestId = getAuthInfo(req)?.requestId;
    const startTime = Date.now();
    const ipAddress = getAuthInfo(req)?.ipAddress || 'unknown';
    const userAgent = getAuthInfo(req)?.userAgent || 'unknown';
    
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

      // Log with obfuscated email for privacy
      logger.debug('Processing login request', {
        requestId,
        email: obfuscateEmail(email),
        ipAddress,
        userAgent
      });

      // Find user - but DON'T reveal if user exists or not (prevents enumeration)
      const user = await User.findOne({ where: { email } });

      // SECURITY: Apply constant-time delay regardless of whether user exists
      // This prevents timing attacks that could enumerate valid accounts
      const loginStartTime = Date.now();

      // Variable to track if login should fail
      let shouldFail = false;
      let isLocked = false;
      let lockoutRemaining = 0;

      if (!user) {
        // User doesn't exist - but don't reveal this!
        shouldFail = true;

        // Log internally but don't expose to client
        logger.warn('Login failed: User not found', {
          requestId,
          email: obfuscateEmail(email),
          ipAddress
        });

        // Still compute a dummy hash to maintain constant time
        // This prevents timing attacks from revealing account existence
        await bcrypt.compare(password, '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.Iq0gHvoLf4JyWq');
      } else {
        // Check if account is locked
        if (user.isLocked()) {
          isLocked = true;
          lockoutRemaining = user.getLockoutRemaining();
          shouldFail = true;

          logger.warn('Login failed: Account locked', {
            requestId,
            userId: user.id,
            email: obfuscateEmail(email),
            ipAddress,
            lockoutRemaining
          });
        } else {
          // Check password using the model's validatePassword method
          const isPasswordValid = await user.validatePassword(password, requestId);

          if (!isPasswordValid) {
            shouldFail = true;

            // Track failed login attempt (may trigger lockout)
            const nowLocked = await user.trackLoginAttempt(false, requestId);

            if (nowLocked) {
              isLocked = true;
              lockoutRemaining = user.getLockoutRemaining();
            }

            logger.warn('Login failed: Invalid credentials', {
              requestId,
              userId: user.id,
              email: obfuscateEmail(email),
              ipAddress,
              loginAttempts: user.loginAttempts,
              isLocked: nowLocked,
              processingTime: Date.now() - startTime
            });
          }
        }
      }

      // SECURITY: Ensure constant-time response to prevent timing attacks
      const elapsed = Date.now() - loginStartTime;
      const remainingDelay = Math.max(0, CONSTANT_LOGIN_DELAY_MS - elapsed);
      if (remainingDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingDelay));
      }

      if (shouldFail) {
        // SECURITY: Return generic error message to prevent user enumeration
        // Do NOT reveal whether the email exists or if password was wrong
        const message = isLocked
          ? `Account temporarily locked. Try again in ${Math.ceil(lockoutRemaining / 60)} minutes.`
          : 'Invalid email or password';

        const errorCode = isLocked ? 'account_locked' : 'invalid_credentials';
        const status = isLocked ? 423 : 401; // 423 = Locked, 401 = Unauthorized

        return sendErrorResponse(
          res,
          status,
          message,
          errorCode,
          requestId,
          isLocked ? { lockoutRemaining } : undefined
        );
      }

      // At this point, user is guaranteed to exist (we returned early if shouldFail)
      // TypeScript assertion for safety
      if (!user) {
        // This should never happen, but handle gracefully
        return sendErrorResponse(res, 500, 'Unexpected error', 'server_error', requestId);
      }

      // Track successful login
      await user.trackLoginAttempt(true, requestId);

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
        email: obfuscateEmail(user.email),
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
  const requestId = getAuthInfo(req)?.requestId;
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
  const requestId = getAuthInfo(req)?.requestId;
  const startTime = Date.now();
  
  try {
    logger.debug('Processing get user info request', {
      requestId,
      userId: getRequestUser(req)?.id
    });
    
    // req.user is set by authMiddleware
    const user = await User.findByPk(getRequestUser(req)?.id);
    
    if (!user) {
      logger.warn('Get user info failed: User not found', {
        requestId,
        userId: getRequestUser(req)?.id
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
      userId: getRequestUser(req)?.id,
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
  const requestId = getAuthInfo(req)?.requestId;
  const startTime = Date.now();
  
  try {
    logger.debug('Processing update user request', {
      requestId,
      userId: getRequestUser(req)?.id
    });
    
    // eslint-disable-next-line camelcase -- API request body uses snake_case
    const { username, email, avatar_url: _avatar_url } = req.body;
    const user = await User.findByPk(getRequestUser(req)?.id);
    
    if (!user) {
      logger.warn('Update user failed: User not found', {
        requestId,
        userId: getRequestUser(req)?.id
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
          userId: getRequestUser(req)?.id,
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
          userId: getRequestUser(req)?.id,
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
      userId: getRequestUser(req)?.id,
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
