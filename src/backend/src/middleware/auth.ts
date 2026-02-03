import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const AUTH_DISABLED = process.env.DISABLE_AUTH === 'true';
const DEV_USER = {
  userId: 0,
  username: 'dev',
  email: 'dev@local',
  role: 'admin'
};

// Interface for JWT payload
interface JwtPayload {
  userId: number;
  username: string;
  email: string;
  role: string;
}

// Extend Express Request type
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Required for Express type augmentation
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware to authenticate JWT tokens
 * Supports tokens in Authorization header or query parameter (for SSE)
 */
export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  if (AUTH_DISABLED) {
    req.user = DEV_USER;
    return next();
  }

  let token: string | undefined;

  // Try to get token from Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  // If not in header, try query parameter (for SSE which doesn't support custom headers)
  if (!token && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    return res.status(401).json({ message: 'Authorization token missing' });
  }

  try {
    // Verify the token (the secret should be in environment variables in production)
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, secret) as JwtPayload;

    // Add user info to request object
    req.user = decoded;

    next();
  } catch (_error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

/**
 * Middleware to check if user has admin role
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (AUTH_DISABLED) {
    req.user = DEV_USER;
    return next();
  }

  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  next();
};
