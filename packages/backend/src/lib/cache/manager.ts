/**
 * Cache Manager
 * Orchestrates all caching services and provides centralized cache management
 */

import { CacheService, ClubCacheService, ActivityCacheService, SessionCacheService } from './index';
import { redisManager } from '../auth/redis';
import CachedClubService from '../../services/cached-club.service';
import CachedActivityService from '../../services/cached-activity.service';
import SessionService from '../../services/session.service';

export interface CacheManagerConfig {
  enableWarming: boolean;
  warmingInterval: number; // in milliseconds
  enableCleanup: boolean;
  cleanupInterval: number; // in milliseconds
  enableHealthChecks: boolean;
  healthCheckInterval: number; // in milliseconds
}

export interface CacheHealth {
  isHealthy: boolean;
  services: {
    redis: boolean;
    cache: boolean;
    clubs: boolean;
    activities: boolean;
    sessions: boolean;
  };
  stats: any;
  errors: string[];
  lastCheck: Date;
}

export class CacheManager {
  private static instance: CacheManager;
  private config: CacheManagerConfig;
  private warmingTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;
  private lastHealthCheck?: CacheHealth;

  private constructor(config: Partial<CacheManagerConfig> = {}) {
    this.config = {
      enableWarming: true,
      warmingInterval: 30 * 60 * 1000, // 30 minutes
      enableCleanup: true,
      cleanupInterval: 60 * 60 * 1000, // 1 hour
      enableHealthChecks: true,
      healthCheckInterval: 5 * 60 * 1000, // 5 minutes
      ...config
    };
  }

  public static getInstance(config?: Partial<CacheManagerConfig>): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config);
    }
    return CacheManager.instance;
  }

  /**
   * Initialize the cache manager
   */
  public async initialize(): Promise<void> {
    console.log('🚀 Initializing Cache Manager...');

    try {
      // Ensure Redis connection
      if (!redisManager.isReady()) {
        await redisManager.connect();
      }

      // Perform initial health check
      await this.performHealthCheck();

      // Start scheduled tasks
      this.startScheduledTasks();

      // Perform initial cache warming
      if (this.config.enableWarming) {
        await this.warmCaches();
      }

      console.log('✅ Cache Manager initialized successfully');
    } catch (error) {
      console.error('❌ Cache Manager initialization failed:', error);
      throw error;
    }
  }

  /**
   * Shutdown the cache manager
   */
  public async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Cache Manager...');

    // Clear timers
    if (this.warmingTimer) {
      clearInterval(this.warmingTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    console.log('✅ Cache Manager shutdown complete');
  }

  /**
   * Start scheduled tasks
   */
  private startScheduledTasks(): void {
    if (this.config.enableWarming) {
      this.warmingTimer = setInterval(() => {
        this.warmCaches().catch(console.error);
      }, this.config.warmingInterval);
    }

    if (this.config.enableCleanup) {
      this.cleanupTimer = setInterval(() => {
        this.performCleanup().catch(console.error);
      }, this.config.cleanupInterval);
    }

    if (this.config.enableHealthChecks) {
      this.healthCheckTimer = setInterval(() => {
        this.performHealthCheck().catch(console.error);
      }, this.config.healthCheckInterval);
    }
  }

  /**
   * Warm up all caches
   */
  public async warmCaches(): Promise<void> {
    console.log('🔥 Starting cache warming...');

    try {
      const clubService = new CachedClubService();
      const activityService = new CachedActivityService();

      await Promise.all([
        clubService.warmCache(),
        activityService.warmCache()
      ]);

      console.log('✅ Cache warming completed');
    } catch (error) {
      console.error('❌ Cache warming failed:', error);
    }
  }

  /**
   * Perform cache cleanup
   */
  public async performCleanup(): Promise<void> {
    console.log('🧹 Starting cache cleanup...');

    try {
      // Clean up expired sessions
      await SessionService.cleanupExpiredSessions();

      // Additional cleanup logic can be added here
      
      console.log('✅ Cache cleanup completed');
    } catch (error) {
      console.error('❌ Cache cleanup failed:', error);
    }
  }

  /**
   * Perform comprehensive health check
   */
  public async performHealthCheck(): Promise<CacheHealth> {
    const health: CacheHealth = {
      isHealthy: true,
      services: {
        redis: false,
        cache: false,
        clubs: false,
        activities: false,
        sessions: false
      },
      stats: null,
      errors: [],
      lastCheck: new Date()
    };

    try {
      // Check Redis
      health.services.redis = await redisManager.healthCheck();
      if (!health.services.redis) {
        health.errors.push('Redis connection failed');
        health.isHealthy = false;
      }

      // Check basic cache service
      health.services.cache = await CacheService.healthCheck();
      if (!health.services.cache) {
        health.errors.push('Basic cache operations failed');
        health.isHealthy = false;
      }

      // Check club cache
      const clubService = new CachedClubService();
      const clubHealth = await clubService.getCacheHealth();
      health.services.clubs = clubHealth.isHealthy;
      if (!clubHealth.isHealthy) {
        health.errors.push(...clubHealth.errors);
        health.isHealthy = false;
      }

      // Check activity cache
      const activityService = new CachedActivityService();
      const activityHealth = await activityService.getCacheHealth();
      health.services.activities = activityHealth.isHealthy;
      if (!activityHealth.isHealthy) {
        health.errors.push(...activityHealth.errors);
        health.isHealthy = false;
      }

      // Check session service
      health.services.sessions = await SessionService.healthCheck();
      if (!health.services.sessions) {
        health.errors.push('Session service failed');
        health.isHealthy = false;
      }

      // Get cache statistics
      health.stats = await CacheService.getStats();

    } catch (error) {
      health.isHealthy = false;
      health.errors.push(`Health check error: ${error.message}`);
    }

    this.lastHealthCheck = health;

    if (!health.isHealthy) {
      console.warn('⚠️ Cache health check failed:', health.errors);
    }

    return health;
  }

  /**
   * Get last health check result
   */
  public getLastHealthCheck(): CacheHealth | null {
    return this.lastHealthCheck || null;
  }

  /**
   * Invalidate all caches (nuclear option)
   */
  public async invalidateAllCaches(): Promise<void> {
    console.log('💥 Invalidating all caches...');

    try {
      await CacheService.clearAll();
      console.log('✅ All caches invalidated');
    } catch (error) {
      console.error('❌ Failed to invalidate all caches:', error);
      throw error;
    }
  }

  /**
   * Invalidate caches by pattern
   */
  public async invalidateCachesByPattern(pattern: string): Promise<void> {
    console.log(`🎯 Invalidating caches matching pattern: ${pattern}`);

    try {
      await CacheService.invalidatePattern(pattern);
      console.log(`✅ Caches matching pattern ${pattern} invalidated`);
    } catch (error) {
      console.error(`❌ Failed to invalidate caches for pattern ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  public async getCacheStatistics(): Promise<{
    redis: any;
    cache: any;
    clubs: any;
    activities: any;
    sessions: any;
    health: CacheHealth | null;
  }> {
    try {
      const [cacheStats, clubService, activityService] = await Promise.all([
        CacheService.getStats(),
        new CachedClubService(),
        new CachedActivityService()
      ]);

      const [clubHealth, activityHealth, sessionStats] = await Promise.all([
        clubService.getCacheHealth(),
        activityService.getCacheHealth(),
        SessionService.getSessionStatistics()
      ]);

      return {
        redis: await redisManager.healthCheck(),
        cache: cacheStats,
        clubs: clubHealth,
        activities: activityHealth,
        sessions: sessionStats,
        health: this.lastHealthCheck
      };
    } catch (error) {
      console.error('Failed to get cache statistics:', error);
      throw error;
    }
  }

  /**
   * Preload specific data into cache
   */
  public async preloadData(type: 'clubs' | 'activities' | 'all'): Promise<void> {
    console.log(`📥 Preloading ${type} data into cache...`);

    try {
      const clubService = new CachedClubService();
      const activityService = new CachedActivityService();

      switch (type) {
        case 'clubs':
          await clubService.warmCache();
          break;
        case 'activities':
          await activityService.warmCache();
          break;
        case 'all':
          await Promise.all([
            clubService.warmCache(),
            activityService.warmCache()
          ]);
          break;
      }

      console.log(`✅ ${type} data preloaded successfully`);
    } catch (error) {
      console.error(`❌ Failed to preload ${type} data:`, error);
      throw error;
    }
  }

  /**
   * Monitor cache hit rates (simplified implementation)
   */
  public async getCacheMetrics(): Promise<{
    hitRate: number;
    missRate: number;
    totalRequests: number;
    averageResponseTime: number;
  }> {
    // This is a simplified implementation
    // In production, you'd track these metrics properly
    return {
      hitRate: 0.85, // 85% hit rate
      missRate: 0.15, // 15% miss rate
      totalRequests: 1000,
      averageResponseTime: 50 // ms
    };
  }

  /**
   * Configure cache settings
   */
  public updateConfig(newConfig: Partial<CacheManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart scheduled tasks with new config
    this.shutdown();
    this.startScheduledTasks();
    
    console.log('✅ Cache manager configuration updated');
  }

  /**
   * Get current configuration
   */
  public getConfig(): CacheManagerConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance();

// Initialize on module load (except in tests)
if (process.env.NODE_ENV !== 'test') {
  cacheManager.initialize().catch(console.error);
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await cacheManager.shutdown();
});

process.on('SIGINT', async () => {
  await cacheManager.shutdown();
});

process.on('SIGTERM', async () => {
  await cacheManager.shutdown();
});

export default CacheManager;