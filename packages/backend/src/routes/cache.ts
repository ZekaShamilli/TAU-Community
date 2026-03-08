/**
 * Cache Management Routes
 * Provides endpoints for cache administration and monitoring
 */

import { Router, Request, Response } from 'express';
import { cacheManager } from '../lib/cache/manager';
import { CacheService } from '../lib/cache';
import { authMiddleware, requireRole } from '../lib/middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

/**
 * Get cache health status
 * GET /api/cache/health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await cacheManager.performHealthCheck();
    
    const statusCode = health.isHealthy ? 200 : 503;
    
    res.status(statusCode).json({
      success: health.isHealthy,
      data: health,
      message: health.isHealthy ? 'Cache is healthy' : 'Cache health issues detected'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check cache health',
      details: error.message
    });
  }
});

/**
 * Get cache statistics
 * GET /api/cache/stats
 * Requires Super Admin role
 */
router.get('/stats', 
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  async (req: Request, res: Response) => {
    try {
      const stats = await cacheManager.getCacheStatistics();
      
      res.json({
        success: true,
        data: stats,
        message: 'Cache statistics retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get cache statistics',
        details: error.message
      });
    }
  }
);

/**
 * Get cache metrics
 * GET /api/cache/metrics
 * Requires Super Admin role
 */
router.get('/metrics',
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  async (req: Request, res: Response) => {
    try {
      const metrics = await cacheManager.getCacheMetrics();
      
      res.json({
        success: true,
        data: metrics,
        message: 'Cache metrics retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get cache metrics',
        details: error.message
      });
    }
  }
);

/**
 * Warm up caches
 * POST /api/cache/warm
 * Requires Super Admin role
 */
router.post('/warm',
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  async (req: Request, res: Response) => {
    try {
      await cacheManager.warmCaches();
      
      res.json({
        success: true,
        message: 'Cache warming completed successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to warm caches',
        details: error.message
      });
    }
  }
);

/**
 * Preload specific data type
 * POST /api/cache/preload/:type
 * Requires Super Admin role
 */
router.post('/preload/:type',
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  async (req: Request, res: Response) => {
    try {
      const { type } = req.params;
      
      if (!['clubs', 'activities', 'all'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid preload type. Must be: clubs, activities, or all'
        });
      }
      
      await cacheManager.preloadData(type as 'clubs' | 'activities' | 'all');
      
      res.json({
        success: true,
        message: `${type} data preloaded successfully`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `Failed to preload ${req.params.type} data`,
        details: error.message
      });
    }
  }
);

/**
 * Invalidate cache by pattern
 * DELETE /api/cache/pattern/:pattern
 * Requires Super Admin role
 */
router.delete('/pattern/:pattern',
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  async (req: Request, res: Response) => {
    try {
      const { pattern } = req.params;
      
      // Decode URL-encoded pattern
      const decodedPattern = decodeURIComponent(pattern);
      
      await cacheManager.invalidateCachesByPattern(decodedPattern);
      
      res.json({
        success: true,
        message: `Caches matching pattern '${decodedPattern}' invalidated successfully`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to invalidate caches',
        details: error.message
      });
    }
  }
);

/**
 * Invalidate all caches (nuclear option)
 * DELETE /api/cache/all
 * Requires Super Admin role
 */
router.delete('/all',
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  async (req: Request, res: Response) => {
    try {
      await cacheManager.invalidateAllCaches();
      
      res.json({
        success: true,
        message: 'All caches invalidated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to invalidate all caches',
        details: error.message
      });
    }
  }
);

/**
 * Update cache configuration
 * PUT /api/cache/config
 * Requires Super Admin role
 */
router.put('/config',
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  async (req: Request, res: Response) => {
    try {
      const config = req.body;
      
      // Validate configuration
      const validKeys = [
        'enableWarming',
        'warmingInterval',
        'enableCleanup',
        'cleanupInterval',
        'enableHealthChecks',
        'healthCheckInterval'
      ];
      
      const invalidKeys = Object.keys(config).filter(key => !validKeys.includes(key));
      if (invalidKeys.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid configuration keys: ${invalidKeys.join(', ')}`
        });
      }
      
      cacheManager.updateConfig(config);
      
      res.json({
        success: true,
        data: cacheManager.getConfig(),
        message: 'Cache configuration updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to update cache configuration',
        details: error.message
      });
    }
  }
);

/**
 * Get current cache configuration
 * GET /api/cache/config
 * Requires Super Admin role
 */
router.get('/config',
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  async (req: Request, res: Response) => {
    try {
      const config = cacheManager.getConfig();
      
      res.json({
        success: true,
        data: config,
        message: 'Cache configuration retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get cache configuration',
        details: error.message
      });
    }
  }
);

/**
 * Perform manual cleanup
 * POST /api/cache/cleanup
 * Requires Super Admin role
 */
router.post('/cleanup',
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  async (req: Request, res: Response) => {
    try {
      await cacheManager.performCleanup();
      
      res.json({
        success: true,
        message: 'Cache cleanup completed successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to perform cache cleanup',
        details: error.message
      });
    }
  }
);

/**
 * Test cache operations
 * POST /api/cache/test
 * Requires Super Admin role
 */
router.post('/test',
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  async (req: Request, res: Response) => {
    try {
      const testKey = `test_${Date.now()}`;
      const testData = { message: 'Cache test', timestamp: new Date() };
      
      // Test set operation
      await CacheService.set(testKey, testData, { ttl: 60 });
      
      // Test get operation
      const retrieved = await CacheService.get(testKey);
      
      // Test delete operation
      await CacheService.delete(testKey);
      
      // Verify deletion
      const afterDelete = await CacheService.get(testKey);
      
      const testResults = {
        setOperation: 'success',
        getOperation: retrieved ? 'success' : 'failed',
        deleteOperation: afterDelete === null ? 'success' : 'failed',
        dataIntegrity: retrieved && retrieved.message === testData.message ? 'success' : 'failed'
      };
      
      const allTestsPassed = Object.values(testResults).every(result => result === 'success');
      
      res.json({
        success: allTestsPassed,
        data: testResults,
        message: allTestsPassed ? 'All cache tests passed' : 'Some cache tests failed'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Cache test failed',
        details: error.message
      });
    }
  }
);

export default router;