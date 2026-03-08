/**
 * Comprehensive caching service for TAU Community
 * Implements caching for frequently accessed data with consistency mechanisms
 */

import { redisManager } from '../auth/redis';
import { RedisClientType } from 'redis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix for namespacing
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  version?: string;
}

/**
 * Main caching service that provides high-level caching operations
 */
export class CacheService {
  private static readonly DEFAULT_TTL = 300; // 5 minutes
  private static readonly CACHE_VERSION_PREFIX = 'version:';
  private static readonly CACHE_DEPENDENCY_PREFIX = 'deps:';

  /**
   * Get Redis client instance
   */
  private static getClient(): RedisClientType {
    return redisManager.getClient();
  }

  /**
   * Generate cache key with optional prefix
   */
  private static generateKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key;
  }

  /**
   * Set cache entry with TTL and versioning
   */
  public static async set<T>(
    key: string, 
    data: T, 
    options: CacheOptions = {}
  ): Promise<void> {
    const client = this.getClient();
    const cacheKey = this.generateKey(key, options.prefix);
    const ttl = options.ttl || this.DEFAULT_TTL;

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version: await this.getVersion(cacheKey)
    };

    await client.setEx(cacheKey, ttl, JSON.stringify(entry));
  }

  /**
   * Get cache entry with consistency check
   */
  public static async get<T>(
    key: string, 
    options: CacheOptions = {}
  ): Promise<T | null> {
    try {
      const client = this.getClient();
      const cacheKey = this.generateKey(key, options.prefix);
      
      const result = await client.get(cacheKey);
      if (!result) {
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(result);
      
      // Check if version is still valid
      const currentVersion = await this.getVersion(cacheKey);
      if (entry.version && entry.version !== currentVersion) {
        // Version mismatch, invalidate cache
        await this.delete(key, options);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Delete cache entry
   */
  public static async delete(key: string, options: CacheOptions = {}): Promise<void> {
    const client = this.getClient();
    const cacheKey = this.generateKey(key, options.prefix);
    await client.del(cacheKey);
  }

  /**
   * Check if cache entry exists
   */
  public static async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    const client = this.getClient();
    const cacheKey = this.generateKey(key, options.prefix);
    const result = await client.exists(cacheKey);
    return result === 1;
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  public static async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    const data = await fetchFunction();
    await this.set(key, data, options);
    return data;
  }

  /**
   * Invalidate cache entries by pattern
   */
  public static async invalidatePattern(pattern: string): Promise<void> {
    const client = this.getClient();
    const keys = await client.keys(pattern);
    
    if (keys.length > 0) {
      await client.del(keys);
    }
  }

  /**
   * Set cache version for consistency tracking
   */
  public static async setVersion(key: string, version?: string): Promise<void> {
    const client = this.getClient();
    const versionKey = `${this.CACHE_VERSION_PREFIX}${key}`;
    const versionValue = version || Date.now().toString();
    
    // Set version with longer TTL than cache entries
    await client.setEx(versionKey, this.DEFAULT_TTL * 4, versionValue);
  }

  /**
   * Get cache version
   */
  public static async getVersion(key: string): Promise<string> {
    const client = this.getClient();
    const versionKey = `${this.CACHE_VERSION_PREFIX}${key}`;
    const version = await client.get(versionKey);
    return version || '1';
  }

  /**
   * Increment cache version to invalidate related entries
   */
  public static async incrementVersion(key: string): Promise<void> {
    const client = this.getClient();
    const versionKey = `${this.CACHE_VERSION_PREFIX}${key}`;
    
    try {
      await client.incr(versionKey);
      await client.expire(versionKey, this.DEFAULT_TTL * 4);
    } catch (error) {
      // If key doesn't exist, set it to 1
      await client.setEx(versionKey, this.DEFAULT_TTL * 4, '1');
    }
  }

  /**
   * Set cache dependencies for invalidation chains
   */
  public static async setDependency(cacheKey: string, dependsOn: string[]): Promise<void> {
    const client = this.getClient();
    const depKey = `${this.CACHE_DEPENDENCY_PREFIX}${cacheKey}`;
    
    if (dependsOn.length > 0) {
      await client.setEx(depKey, this.DEFAULT_TTL * 2, JSON.stringify(dependsOn));
    }
  }

  /**
   * Invalidate cache and all dependent caches
   */
  public static async invalidateWithDependencies(key: string, options: CacheOptions = {}): Promise<void> {
    const client = this.getClient();
    const cacheKey = this.generateKey(key, options.prefix);
    
    // Get dependencies
    const depKey = `${this.CACHE_DEPENDENCY_PREFIX}${cacheKey}`;
    const depsResult = await client.get(depKey);
    
    // Invalidate main cache
    await this.delete(key, options);
    await this.incrementVersion(cacheKey);
    
    // Invalidate dependencies
    if (depsResult) {
      try {
        const dependencies: string[] = JSON.parse(depsResult);
        const invalidationPromises = dependencies.map(dep => 
          this.invalidateWithDependencies(dep)
        );
        await Promise.all(invalidationPromises);
      } catch (error) {
        console.error('Error invalidating dependencies:', error);
      }
    }
  }

  /**
   * Get cache statistics
   */
  public static async getStats(): Promise<{
    totalKeys: number;
    cacheKeys: number;
    versionKeys: number;
    dependencyKeys: number;
  }> {
    const client = this.getClient();
    
    const [totalKeys, versionKeys, dependencyKeys] = await Promise.all([
      client.dbSize(),
      client.keys(`${this.CACHE_VERSION_PREFIX}*`),
      client.keys(`${this.CACHE_DEPENDENCY_PREFIX}*`)
    ]);

    return {
      totalKeys,
      cacheKeys: totalKeys - versionKeys.length - dependencyKeys.length,
      versionKeys: versionKeys.length,
      dependencyKeys: dependencyKeys.length
    };
  }

  /**
   * Clear all cache entries (use with caution)
   */
  public static async clearAll(): Promise<void> {
    const client = this.getClient();
    await client.flushDb();
  }

  /**
   * Health check for cache service
   */
  public static async healthCheck(): Promise<boolean> {
    try {
      const testKey = 'health_check_test';
      const testValue = { test: true, timestamp: Date.now() };
      
      await this.set(testKey, testValue, { ttl: 10 });
      const retrieved = await this.get(testKey);
      await this.delete(testKey);
      
      return retrieved !== null && (retrieved as any).test === true;
    } catch (error) {
      console.error('Cache health check failed:', error);
      return false;
    }
  }
}

/**
 * Specialized caching services for different data types
 */

/**
 * Club-specific caching service
 */
export class ClubCacheService {
  private static readonly PREFIX = 'club';
  private static readonly LIST_PREFIX = 'club_list';
  private static readonly TTL = 600; // 10 minutes

  public static async getClub(clubId: string): Promise<any | null> {
    return CacheService.get(`${clubId}`, { prefix: this.PREFIX, ttl: this.TTL });
  }

  public static async setClub(clubId: string, clubData: any): Promise<void> {
    await CacheService.set(`${clubId}`, clubData, { prefix: this.PREFIX, ttl: this.TTL });
    
    // Set dependencies - club changes should invalidate club lists
    await CacheService.setDependency(
      `${this.PREFIX}:${clubId}`, 
      [`${this.LIST_PREFIX}:all`, `${this.LIST_PREFIX}:active`]
    );
  }

  public static async invalidateClub(clubId: string): Promise<void> {
    await CacheService.invalidateWithDependencies(`${clubId}`, { prefix: this.PREFIX });
  }

  public static async getClubList(filter: string = 'all'): Promise<any[] | null> {
    return CacheService.get(`${filter}`, { prefix: this.LIST_PREFIX, ttl: this.TTL });
  }

  public static async setClubList(filter: string = 'all', clubs: any[]): Promise<void> {
    await CacheService.set(`${filter}`, clubs, { prefix: this.LIST_PREFIX, ttl: this.TTL });
  }

  public static async invalidateClubLists(): Promise<void> {
    await CacheService.invalidatePattern(`${this.LIST_PREFIX}:*`);
  }
}

/**
 * Activity-specific caching service
 */
export class ActivityCacheService {
  private static readonly PREFIX = 'activity';
  private static readonly LIST_PREFIX = 'activity_list';
  private static readonly TTL = 300; // 5 minutes (activities change more frequently)

  public static async getActivity(activityId: string): Promise<any | null> {
    return CacheService.get(`${activityId}`, { prefix: this.PREFIX, ttl: this.TTL });
  }

  public static async setActivity(activityId: string, activityData: any): Promise<void> {
    await CacheService.set(`${activityId}`, activityData, { prefix: this.PREFIX, ttl: this.TTL });
    
    // Activities depend on club activity lists
    const clubId = activityData.clubId;
    if (clubId) {
      await CacheService.setDependency(
        `${this.PREFIX}:${activityId}`,
        [`${this.LIST_PREFIX}:club:${clubId}`, `${this.LIST_PREFIX}:all`]
      );
    }
  }

  public static async invalidateActivity(activityId: string): Promise<void> {
    await CacheService.invalidateWithDependencies(`${activityId}`, { prefix: this.PREFIX });
  }

  public static async getActivityList(clubId?: string, filter: string = 'all'): Promise<any[] | null> {
    const key = clubId ? `club:${clubId}:${filter}` : filter;
    return CacheService.get(key, { prefix: this.LIST_PREFIX, ttl: this.TTL });
  }

  public static async setActivityList(activities: any[], clubId?: string, filter: string = 'all'): Promise<void> {
    const key = clubId ? `club:${clubId}:${filter}` : filter;
    await CacheService.set(key, activities, { prefix: this.LIST_PREFIX, ttl: this.TTL });
  }

  public static async invalidateActivityLists(clubId?: string): Promise<void> {
    if (clubId) {
      await CacheService.invalidatePattern(`${this.LIST_PREFIX}:club:${clubId}:*`);
    } else {
      await CacheService.invalidatePattern(`${this.LIST_PREFIX}:*`);
    }
  }
}

/**
 * Session-specific caching service
 */
export class SessionCacheService {
  private static readonly PREFIX = 'session';
  private static readonly TTL = 900; // 15 minutes

  public static async getSession(sessionId: string): Promise<any | null> {
    return CacheService.get(`${sessionId}`, { prefix: this.PREFIX, ttl: this.TTL });
  }

  public static async setSession(sessionId: string, sessionData: any): Promise<void> {
    await CacheService.set(`${sessionId}`, sessionData, { prefix: this.PREFIX, ttl: this.TTL });
  }

  public static async invalidateSession(sessionId: string): Promise<void> {
    await CacheService.delete(`${sessionId}`, { prefix: this.PREFIX });
  }

  public static async getUserSessions(userId: string): Promise<string[]> {
    const client = redisManager.getClient();
    const pattern = `${this.PREFIX}:*`;
    const keys = await client.keys(pattern);
    
    const userSessions: string[] = [];
    
    for (const key of keys) {
      const sessionData = await client.get(key);
      if (sessionData) {
        try {
          const parsed = JSON.parse(sessionData);
          if (parsed.data && parsed.data.userId === userId) {
            userSessions.push(key.replace(`${this.PREFIX}:`, ''));
          }
        } catch (error) {
          // Skip invalid session data
        }
      }
    }
    
    return userSessions;
  }

  public static async invalidateUserSessions(userId: string): Promise<void> {
    const sessions = await this.getUserSessions(userId);
    const invalidationPromises = sessions.map(sessionId => 
      this.invalidateSession(sessionId)
    );
    await Promise.all(invalidationPromises);
  }
}