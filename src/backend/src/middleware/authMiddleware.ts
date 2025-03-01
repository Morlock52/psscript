import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import logger from '../utils/logger';

// Extend the Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

/**
 * Middleware to authenticate JWT tokens
 * Adds the user information to the request object if authenticated
 */
export const authenticateJWT = async (req: Request, res: Response, next: NextFunction) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }
  
  // Extract token (remove "Bearer " prefix)
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Invalid token format.' });
  }
  
  try {
    // Verify token
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'development_secret');
    
    // Get user from database
    const user = await User.findByPk(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }
    
    if (!user.isActive) {
      return res.status(401).json({ message: 'User account is disabled.' });
    }
    
    // Add user information to request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };
    
    next();
  } catch (error) {
    logger.error('JWT verification error:', error);
    return res.status(401).json({ message: 'Invalid token.' });
  }
};

/**
 * Middleware to check if user has admin role
 * Must be used after authenticateJWT
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  }
  
  next();
};

/**
 * Optional JWT authentication
 * Adds user information to request if token is valid, but continues if no token or invalid token
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  
  // If no header, continue without authentication
  if (!authHeader) {
    return next();
  }
  
  // Extract token (remove "Bearer " prefix)
  const token = authHeader.split(' ')[1];
  
  // If no token, continue without authentication
  if (!token) {
    return next();
  }
  
  try {
    // Verify token
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'development_secret');
    
    // Get user from database
    const user = await User.findByPk(decoded.userId);
    
    if (user && user.isActive) {
      // Add user information to request
      req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      };
    }
    
    next();
  } catch (error) {
    // If token verification fails, continue without user info
    next();
  }
};