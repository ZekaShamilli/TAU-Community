/**
 * Caching middleware for Express routes
 * Provides automatic caching of API responses with invalidation strategies
 */

import { Request, Response, NextFunction } from 'express';
import { CacheService } from './index';

export interface CacheMiddlewareOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request, res: Response) => boolean;
  prefix?: string;
  varyBy?: string[]; // Headers or query params to vary cache by
}

/**
 * Create cache key from request
 */
function generateCacheKey(req: Request, options: CacheMiddlewareOptions): string {
  if (options.keyGenerator) {
    return options.keyGenerator(req);
  }

  // Default key generation
  let key = `${req.method}:${req.path}`;
  
  // Add query parameters
  const queryKeys = Object.keys(req.query).sort();
  if (queryKeys.length > 0) {
    const queryString = queryKeys
      .map(k => `${k}=${req.query[k]}`)
      .join('&');
    key += `?${queryString}`;
  }

  // Add vary-by headers
  if (options.varyBy) {
    const varyValues = options.varyBy
      .map(header => `${header}:${req.get(header) || ''}`)
      .join('|');
    key += `|${varyValues}`;
  }

  // Add user context for personalized content
  if (req.user) {
    key += `|user:${req.user.id}|role:${req.user.role}`;
  }

  return key;
}

/**
 * Cache middleware factory
 */
export function cacheMiddleware(options: CacheMiddlewareOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests by default
    if (req.method !== 'GET') {
      return next();
    }

    // Check condition if provided
    if (options.condition && !options.condition(req, res)) {
      return next();
    }

    const cacheKey = generateCacheKey(req, options);
    
    try {
      // Try to get from cache
      const cachedData = await CacheService.get(cacheKey, {
        prefix: options.prefix,
        ttl: options.ttl
      });

      if (cachedData) {
        // Cache hit - return cached response
        res.json(cachedData);
        return;
      }

      // Cache miss - intercept response to cache it
      const originalJson = res.json;
      let responseData: any;

      res.json = function(data: any) {
        responseData = data;
        return originalJson.call(this, data);
      };

      // Continue to next middleware
      res.on('finish', async () => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300 && responseData) {
          try {
            await CacheService.set(cacheKey, responseData, {
              prefix: options.prefix,
              ttl: options.ttl
            });
          } catch (error) {
            console.error('Failed to cache response:', error);
          }
        }
      });

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      // Continue without caching on error
      next();
    }
  };
}

/**
 * Cache invalidation middleware
 * Invalidates cache entries when data is modified
 */
export interface InvalidationOptions {
  patterns?: string[];
  keys?: string[];
  dependencies?: string[];
  prefix?: string;
}

export function invalidateCache(options: InvalidationOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original response methods
    const originalJson = res.json;
    const originalSend = res.send;

    // Intercept successful responses
    const handleResponse = async (data: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          // Invalidate specific keys
          if (options.keys) {
            const invalidationPromises = options.keys.map(key =>
              CacheService.delete(key, { prefix: options.prefix })
            );
            await Promise.all(invalidationPromises);
          }

          // Invalidate patterns
          if (options.patterns) {
            const patternPromises = options.patterns.map(pattern =>
              CacheService.invalidatePattern(pattern)
            );
            await Promise.all(patternPromises);
          }

          // Invalidate dependencies
          if (options.dependencies) {
            const depPromises = options.dependencies.map(dep =>
              CacheService.invalidateWithDependencies(dep, { prefix: options.prefix })
            );
            await Promise.all(depPromises);
          }
        } catch (error) {
          console.error('Cache invalidation error:', error);
        }
      }
    };

    // Override response methods
    res.json = function(data: any) {
      handleResponse(data);
      return originalJson.call(this, data);
    };

    res.send = function(data: any) {
      handleResponse(data);
      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Conditional cache middleware based on user role
 */
export function roleBasedCache(options: CacheMiddlewareOptions & {
  roles?: string[];
  skipRoles?: string[];
}) {
  return cacheMiddleware({
    ...options,
    condition: (req: Request) => {
      if (!req.user) {
        return true; // Cache public content
      }

      const userRole = req.user.role;

      // Skip caching for specific roles
      if (options.skipRoles && options.skipRoles.includes(userRole)) {
        return false;
      }

      // Only cache for specific roles
      if (options.roles && !options.roles.includes(userRole)) {
        return false;
      }

      return true;
    }
  });
}

/**
 * Smart cache middleware that varies by user permissions
 */
export function smartCache(options: CacheMiddlewareOptions = {}) {
  return cacheMiddleware({
    ...options,
    keyGenerator: (req: Request) => {
      let key = `${req.method}:${req.path}`;
      
      // Add query parameters
      const queryKeys = Object.keys(req.query).sort();
      if (queryKeys.length > 0) {
        const queryString = queryKeys
          .map(k => `${k}=${req.query[k]}`)
          .join('&');
        key += `?${queryString}`;
      }

      // For authenticated users, vary by role and club access
      if (req.user) {
        key += `|role:${req.user.role}`;
        
        // For club presidents, include their club ID
        if (req.user.role === 'CLUB_PRESIDENT' && req.user.clubId) {
          key += `|club:${req.user.clubId}`;
        }
      } else {
        key += '|public';
      }

      return key;
    }
  });
}

/**
 * Cache warming utilities
 */
export class CacheWarmer {
  /**
   * Warm up frequently accessed data
   */
  public static async warmCache(): Promise<void> {
    console.log('Starting cache warming...');
    
    try {
      // This would typically fetch and cache frequently accessed data
      // Implementation depends on your specific services
      
      console.log('Cache warming completed');
    } catch (error) {
      console.error('Cache warming failed:', error);
    }
  }

  /**
   * Schedule periodic cache warming
   */
  public static scheduleWarming(intervalMs: number = 30 * 60 * 1000): void {
    setInterval(() => {
      this.warmCache().catch(console.error);
    }, intervalMs);
  }
}

// Export middleware functions
export {
  cacheMiddleware,
  invalidateCache,
  roleBasedCache,
  smartCache,
  CacheWarmer
};