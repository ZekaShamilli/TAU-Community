/**
 * Cached Activity Service
 * Extends the base ActivityService with comprehensive caching capabilities
 */

import ActivityService, { 
  CreateActivityRequest, 
  UpdateActivityRequest, 
  ActivityFilters, 
  ActivityWithDetails 
} from './activity.service';
import { ActivityCacheService, CacheService } from '../lib/cache';
import { ActivityStatus, UserRole } from '@prisma/client';

export class CachedActivityService extends ActivityService {
  private static readonly CACHE_TTL = 300; // 5 minutes (activities change more frequently)
  private static readonly LIST_CACHE_TTL = 180; // 3 minutes for lists
  private static readonly PUBLIC_CACHE_TTL = 600; // 10 minutes for public data

  /**
   * Create a new activity with cache invalidation
   */
  async createActivity(
    data: CreateActivityRequest, 
    createdBy: string, 
    userRole: UserRole
  ): Promise<ActivityWithDetails> {
    const activity = await super.createActivity(data, createdBy, userRole);
    
    // Cache the new activity
    await ActivityCacheService.setActivity(activity.id, activity);
    
    // Invalidate related caches
    await this.invalidateActivityRelatedCaches(activity.clubId, activity.id);
    
    return activity;
  }

  /**
   * Get an activity by ID with caching
   */
  async getActivity(id: string, includeDetails: boolean = true): Promise<ActivityWithDetails | null> {
    const cacheKey = `${id}:${includeDetails}`;
    
    return await CacheService.getOrSet(
      cacheKey,
      async () => {
        return await super.getActivity(id, includeDetails);
      },
      { prefix: 'activity', ttl: CachedActivityService.CACHE_TTL }
    );
  }

  /**
   * Update an activity with cache invalidation
   */
  async updateActivity(
    id: string, 
    data: UpdateActivityRequest, 
    updatedBy: string, 
    userRole: UserRole
  ): Promise<ActivityWithDetails> {
    // Get the current activity to know which caches to invalidate
    const currentActivity = await this.getActivity(id, false);
    
    const updatedActivity = await super.updateActivity(id, data, updatedBy, userRole);
    
    // Update cache with new data
    await ActivityCacheService.setActivity(id, updatedActivity);
    
    // Invalidate related caches
    await this.invalidateActivityRelatedCaches(updatedActivity.clubId, id);
    
    // If club changed, invalidate old club caches too
    if (currentActivity && currentActivity.clubId !== updatedActivity.clubId) {
      await this.invalidateActivityRelatedCaches(currentActivity.clubId, id);
    }
    
    return updatedActivity;
  }

  /**
   * Delete an activity with cache cleanup
   */
  async deleteActivity(id: string, deletedBy: string, userRole: UserRole): Promise<void> {
    // Get activity data before deletion for cache cleanup
    const activity = await this.getActivity(id, false);
    
    await super.deleteActivity(id, deletedBy, userRole);
    
    // Comprehensive cache cleanup
    if (activity) {
      await this.performActivityDeletionCacheCleanup(id, activity.clubId);
    }
  }

  /**
   * List activities with caching
   */
  async listActivities(
    filters: ActivityFilters = {},
    page: number = 1,
    limit: number = 20,
    orderBy: 'startDate' | 'createdAt' | 'title' = 'startDate',
    orderDirection: 'asc' | 'desc' = 'asc'
  ): Promise<{ activities: ActivityWithDetails[]; total: number; page: number; totalPages: number }> {
    const cacheKey = this.generateListCacheKey(filters, page, limit, orderBy, orderDirection);
    
    return await CacheService.getOrSet(
      cacheKey,
      async () => {
        return await super.listActivities(filters, page, limit, orderBy, orderDirection);
      },
      { prefix: 'activity_list', ttl: CachedActivityService.LIST_CACHE_TTL }
    );
  }

  /**
   * Get activities for a specific club with caching
   */
  async getClubActivities(
    clubId: string, 
    includeCompleted: boolean = true,
    limit?: number
  ): Promise<ActivityWithDetails[]> {
    const cacheKey = `club:${clubId}:completed:${includeCompleted}:limit:${limit || 'all'}`;
    
    return await CacheService.getOrSet(
      cacheKey,
      async () => {
        return await super.getClubActivities(clubId, includeCompleted, limit);
      },
      { prefix: 'activity_list', ttl: CachedActivityService.CACHE_TTL }
    );
  }

  /**
   * Get upcoming activities with heavy caching (public data)
   */
  async getUpcomingActivities(limit: number = 10): Promise<ActivityWithDetails[]> {
    const cacheKey = `upcoming:${limit}`;
    
    return await CacheService.getOrSet(
      cacheKey,
      async () => {
        return await super.getUpcomingActivities(limit);
      },
      { prefix: 'activity_list', ttl: CachedActivityService.PUBLIC_CACHE_TTL }
    );
  }

  /**
   * Update activity statuses with cache invalidation
   */
  async updateActivityStatuses(): Promise<number> {
    const count = await super.updateActivityStatuses();
    
    if (count > 0) {
      // Invalidate all activity caches since statuses changed
      await this.invalidateAllActivityCaches();
    }
    
    return count;
  }

  /**
   * Get activity version history with caching
   */
  async getActivityVersionHistory(activityId: string): Promise<any[]> {
    const cacheKey = `history:${activityId}`;
    
    return await CacheService.getOrSet(
      cacheKey,
      async () => {
        return await super.getActivityVersionHistory(activityId);
      },
      { prefix: 'activity', ttl: 900 } // 15 minutes for history
    );
  }

  /**
   * Rollback activity with cache invalidation
   */
  async rollbackActivity(
    activityId: string,
    targetVersionId: string,
    rolledBackBy: string,
    userRole: UserRole
  ): Promise<ActivityWithDetails> {
    const rolledBackActivity = await super.rollbackActivity(
      activityId, 
      targetVersionId, 
      rolledBackBy, 
      userRole
    );
    
    // Update cache with rolled back data
    await ActivityCacheService.setActivity(activityId, rolledBackActivity);
    
    // Invalidate version history cache
    await CacheService.delete(`history:${activityId}`, { prefix: 'activity' });
    
    // Invalidate related caches
    await this.invalidateActivityRelatedCaches(rolledBackActivity.clubId, activityId);
    
    return rolledBackActivity;
  }

  /**
   * Compare activity versions with caching
   */
  async compareActivityVersions(
    activityId: string,
    version1Id: string,
    version2Id: string
  ): Promise<any> {
    const cacheKey = `compare:${activityId}:${version1Id}:${version2Id}`;
    
    return await CacheService.getOrSet(
      cacheKey,
      async () => {
        return await super.compareActivityVersions(activityId, version1Id, version2Id);
      },
      { prefix: 'activity', ttl: 1800 } // 30 minutes for comparisons
    );
  }

  /**
   * Validate activity access with caching
   */
  async validateActivityAccess(
    activityId: string, 
    userId: string, 
    userRole: UserRole,
    action: 'READ' | 'WRITE' = 'read'
  ): Promise<boolean> {
    const cacheKey = `access:${activityId}:${userId}:${userRole}:${action}`;
    
    return await CacheService.getOrSet(
      cacheKey,
      async () => {
        return await super.validateActivityAccess(activityId, userId, userRole, action);
      },
      { prefix: 'activity_access', ttl: 300 } // 5 minutes for access checks
    );
  }

  /**
   * Get activity statistics with caching
   */
  async getActivityStatistics(clubId?: string): Promise<{
    totalActivities: number;
    publishedActivities: number;
    draftActivities: number;
    completedActivities: number;
    upcomingActivities: number;
  }> {
    const cacheKey = clubId ? `stats:club:${clubId}` : 'stats:all';
    
    return await CacheService.getOrSet(
      cacheKey,
      async () => {
        const filters: ActivityFilters = clubId ? { clubId } : {};
        
        const [total, published, draft, completed, upcoming] = await Promise.all([
          this.listActivities(filters, 1, 1),
          this.listActivities({ ...filters, status: ActivityStatus.PUBLISHED }, 1, 1),
          this.listActivities({ ...filters, status: ActivityStatus.DRAFT }, 1, 1),
          this.listActivities({ ...filters, status: ActivityStatus.COMPLETED }, 1, 1),
          this.listActivities({ 
            ...filters, 
            status: ActivityStatus.PUBLISHED,
            startDateFrom: new Date()
          }, 1, 1)
        ]);
        
        return {
          totalActivities: total.total,
          publishedActivities: published.total,
          draftActivities: draft.total,
          completedActivities: completed.total,
          upcomingActivities: upcoming.total
        };
      },
      { prefix: 'activity_stats', ttl: 1800 } // 30 minutes for statistics
    );
  }

  /**
   * Get popular activities (most viewed/accessed) with caching
   */
  async getPopularActivities(limit: number = 10): Promise<ActivityWithDetails[]> {
    const cacheKey = `popular:${limit}`;
    
    return await CacheService.getOrSet(
      cacheKey,
      async () => {
        // This is a simplified version - in a real implementation,
        // you'd track view counts and sort by popularity
        return await this.getUpcomingActivities(limit);
      },
      { prefix: 'activity_list', ttl: 1800 } // 30 minutes for popular content
    );
  }

  /**
   * Warm up frequently accessed activity data
   */
  async warmCache(): Promise<void> {
    try {
      console.log('Warming activity cache...');
      
      // Warm up upcoming activities
      await this.getUpcomingActivities(20);
      
      // Warm up popular activities
      await this.getPopularActivities(10);
      
      // Warm up activity statistics
      await this.getActivityStatistics();
      
      // Warm up first page of all activities
      await this.listActivities({}, 1, 20);
      
      console.log('Activity cache warming completed');
    } catch (error) {
      console.error('Activity cache warming failed:', error);
    }
  }

  /**
   * Invalidate all activity-related caches
   */
  async invalidateAllActivityCaches(): Promise<void> {
    await Promise.all([
      CacheService.invalidatePattern('activity:*'),
      CacheService.invalidatePattern('activity_list:*'),
      CacheService.invalidatePattern('activity_access:*'),
      CacheService.invalidatePattern('activity_stats:*')
    ]);
  }

  /**
   * Generate cache key for list operations
   */
  private generateListCacheKey(
    filters: ActivityFilters, 
    page: number, 
    limit: number,
    orderBy: string,
    orderDirection: string
  ): string {
    const filterKeys = Object.keys(filters).sort();
    const filterString = filterKeys
      .map(key => {
        const value = filters[key as keyof ActivityFilters];
        if (value instanceof Date) {
          return `${key}:${value.toISOString()}`;
        }
        return `${key}:${value}`;
      })
      .join('|');
    
    return `list:${filterString}:page:${page}:limit:${limit}:order:${orderBy}:${orderDirection}`;
  }

  /**
   * Invalidate caches related to a specific activity and club
   */
  private async invalidateActivityRelatedCaches(clubId: string, activityId: string): Promise<void> {
    await Promise.all([
      // Invalidate activity-specific caches
      CacheService.invalidatePattern(`activity:${activityId}*`),
      
      // Invalidate activity lists for this club
      ActivityCacheService.invalidateActivityLists(clubId),
      
      // Invalidate general activity lists
      ActivityCacheService.invalidateActivityLists(),
      
      // Invalidate access caches for this activity
      CacheService.invalidatePattern(`activity_access:${activityId}:*`),
      
      // Invalidate statistics
      CacheService.invalidatePattern('activity_stats:*'),
      
      // Invalidate upcoming activities (might include this activity)
      CacheService.invalidatePattern('activity_list:upcoming:*'),
      CacheService.invalidatePattern('activity_list:popular:*')
    ]);
  }

  /**
   * Comprehensive cache cleanup when an activity is deleted
   */
  private async performActivityDeletionCacheCleanup(activityId: string, clubId: string): Promise<void> {
    await Promise.all([
      // Remove all activity-specific caches
      CacheService.invalidatePattern(`activity:${activityId}*`),
      
      // Remove access caches
      CacheService.invalidatePattern(`activity_access:${activityId}:*`),
      
      // Invalidate all lists and statistics
      ActivityCacheService.invalidateActivityLists(clubId),
      ActivityCacheService.invalidateActivityLists(),
      CacheService.invalidatePattern('activity_stats:*'),
      
      // Invalidate public lists
      CacheService.invalidatePattern('activity_list:upcoming:*'),
      CacheService.invalidatePattern('activity_list:popular:*')
    ]);
  }

  /**
   * Get cache health and statistics
   */
  async getCacheHealth(): Promise<{
    isHealthy: boolean;
    stats: any;
    errors: string[];
  }> {
    const errors: string[] = [];
    let isHealthy = true;

    try {
      // Test basic cache operations
      const testKey = 'health_test_activity';
      const testData = { 
        id: 'test', 
        title: 'Test Activity',
        clubId: 'test-club',
        startDate: new Date(),
        endDate: new Date()
      };
      
      await ActivityCacheService.setActivity(testKey, testData);
      const retrieved = await ActivityCacheService.getActivity(testKey);
      await ActivityCacheService.invalidateActivity(testKey);
      
      if (!retrieved || retrieved.title !== testData.title) {
        errors.push('Basic activity cache operations failed');
        isHealthy = false;
      }
      
      // Get cache statistics
      const stats = await CacheService.getStats();
      
      return {
        isHealthy,
        stats,
        errors
      };
    } catch (error) {
      errors.push(`Activity cache health check failed: ${error.message}`);
      return {
        isHealthy: false,
        stats: null,
        errors
      };
    }
  }
}

export default CachedActivityService;