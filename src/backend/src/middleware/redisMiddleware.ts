import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import logger from '../utils/logger';

// Define types for cached responses
interface CachedResponse {
  statusCode: number;
  body: any;
  headers: { [key: string]: string };
}

/**
 * Redis middleware for caching API responses
 * Creates middleware with the provided Redis client
 */
export const redisMiddleware = (redisClient: Redis) => {
  // Return middleware function
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip non-GET requests or requests with query parameters
    if (req.method !== 'GET' || Object.keys(req.query).length > 0) {
      return next();
    }

    // Skip auth routes and other non-cacheable endpoints
    const skipRoutes = [
      '/api/auth', 
      '/api/health', 
      '/api/users/me'
    ];
    
    if (skipRoutes.some(route => req.path.startsWith(route))) {
      return next();
    }

    // Create a unique cache key based on the request path
    const cacheKey = `api:cache:${req.path}`;
    
    // Define cache TTL based on route
    let cacheTTL = 300; // Default: 5 minutes
    
    if (req.path.includes('/scripts/')) {
      cacheTTL = 3600; // Script details: 1 hour
    } else if (req.path.includes('/categories')) {
      cacheTTL = 86400; // Categories: 1 day
    }

    // Try to get cached response
    redisClient.get(cacheKey)
      .then(cachedData => {
        if (cachedData) {
          try {
            // Parse cached response
            const cachedResponse = JSON.parse(cachedData) as CachedResponse;
            
            // Set headers from cache
            Object.entries(cachedResponse.headers).forEach(([key, value]) => {
              res.setHeader(key, value);
            });
            
            // Add cache header
            res.setHeader('X-Cache', 'HIT');
            
            // Send cached response
            return res.status(cachedResponse.statusCode).json(cachedResponse.body);
          } catch (error) {
            logger.error('Error parsing cached response:', error);
            // Continue with request if parsing fails
          }
        }
        
        // Cache miss - continue with request
        res.setHeader('X-Cache', 'MISS');
        
        // Intercept the response to cache it
        const originalSend = res.send;
        res.send = function(body): Response {
          // Only cache successful responses
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              // Create cached response object
              const cachedResponse: CachedResponse = {
                statusCode: res.statusCode,
                body: JSON.parse(body), // Only cache JSON responses
                headers: {}
              };
              
              // Cache important headers
              ['content-type', 'etag', 'content-language'].forEach(header => {
                if (res.getHeader(header)) {
                  cachedResponse.headers[header] = res.getHeader(header) as string;
                }
              });
              
              // Save to Redis with expiration
              redisClient.setex(cacheKey, cacheTTL, JSON.stringify(cachedResponse))
                .catch(err => {
                  logger.error('Error caching response:', err);
                });
            } catch (error) {
              // If not valid JSON or other error, don't cache
              logger.debug('Response not cached (not valid JSON)');
            }
          }
          
          // Call the original send method
          return originalSend.call(this, body);
        };
        
        next();
      })
      .catch(error => {
        logger.error('Redis cache error:', error);
        next();
      });
  };
};