/**
 * Cached Club Service
 * Extends the base ClubService with comprehensive caching capabilities
 */

import ClubService, { CreateClubRequest, UpdateClubRequest, ClubFilters, ClubWithPresident } from './club.service';
import { ClubCacheService, CacheService } from '../lib/cache';
import { UserRole } from '@prisma/client';

export class CachedClubService extends ClubService {
  private static readonly CACHE_TTL = 600; // 10 minutes
  private static readonly LIST_CACHE_TTL = 300; // 5 minutes

  /**
   * Create a new club with cache invalidation
   */
  async createClub(data: CreateClubRequest, createdBy: string): Promise<ClubWithPresident> {
    const club = await super.createClub(data, createdBy);
    
    // Cache the new club
    await ClubCacheService.setClub(club.id, club);
    
    // Invalidate club lists since we added a new club
    await ClubCacheService.invalidateClubLists();
    
    // Invalidate related caches
    await this.invalidateRelatedCaches(club.id);
    
    return club;
  }

  /**
   * Get a club by ID with caching
   */
  async getClub(id: string, includePresident: boolean = true): Promise<ClubWithPresident | null> {
    const cacheKey = `${id}:${includePresident}`;
    
    return await CacheService.getOrSet(
      cacheKey,
      async () => {
        return await super.getClub(id, includePresident);
      },
      { prefix: 'club', ttl: CachedClubService.CACHE_TTL }
    );
  }

  /**
   * Get a club by URL slug with caching
   */
  async getClubBySlug(urlSlug: string, includePresident: boolean = true): Promise<ClubWithPresident | null> {
    const cacheKey = `slug:${urlSlug}:${includePresident}`;
    
    return await CacheService.getOrSet(
      cacheKey,
      async () => {
        return await super.getClubBySlug(urlSlug, includePresident);
      },
      { prefix: 'club', ttl: CachedClubService.CACHE_TTL }
    );
  }

  /**
   * Update a club with cache invalidation
   */
  async updateClub(id: string, data: UpdateClubRequest, updatedBy: string): Promise<ClubWithPresident> {
    const updatedClub = await super.updateClub(id, data, updatedBy);
    
    // Update cache with new data
    await ClubCacheService.setClub(id, updatedClub);
    
    // Invalidate slug-based cache if name changed
    if (data.name) {
      await CacheService.invalidatePattern('club:slug:*');
    }
    
    // Invalidate club lists
    await ClubCacheService.invalidateClubLists();
    
    // Invalidate related caches
    await this.invalidateRelatedCaches(id);
    
    return updatedClub;
  }

  /**
   * Delete a club with comprehensive cache cleanup
   */
  async deleteClub(id: string, deletedBy: string): Promise<void> {
    // Get club data before deletion for cache cleanup
    const club = await this.getClub(id, false);
    
    await super.deleteClub(id, deletedBy);
    
    // Comprehensive cache cleanup
    await this.performClubDeletionCacheCleanup(id, club);
  }

  /**
   * List clubs with caching
   */
  async listClubs(
    filters: ClubFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{ clubs: ClubWithPresident[]; total: number; page: number; totalPages: number }> {
    // Create cache key based on filters and pagination
    const cacheKey = this.generateListCacheKey(filters, page, limit);
    
    return await CacheService.getOrSet(
      cacheKey,
      async () => {
        return await super.listClubs(filters, page, limit);
      },
      { prefix: 'club_list', ttl: CachedClubService.LIST_CACHE_TTL }
    );
  }

  /**
   * Get clubs for a specific president with caching
   */
  async getClubsByPresident(presidentId: string): Promise<ClubWithPresident[]> {
    const cacheKey = `president:${presidentId}`;
    
    return await CacheService.getOrSet(
      cacheKey,
      async () => {
        return await super.getClubsByPresident(presidentId);
      },
      { prefix: 'club_list', ttl: CachedClubService.CACHE_TTL }
    );
  }

  /**
   * Validate club access with caching
   */
  async validateClubAccess(clubId: string, userId: string, userRole: UserRole): Promise<boolean> {
    const cacheKey = `access:${clubId}:${userId}:${userRole}`;
    
    return await CacheService.getOrSet(
      cacheKey,
      async () => {
        return await super.validateClubAccess(clubId, userId, userRole);
      },
      { prefix: 'club_access', ttl: 300 } // 5 minutes for access checks
    );
  }

  /**
   * Get active clubs for public display (heavily cached)
   */
  async getActiveClubsForPublic(): Promise<ClubWithPresident[]> {
    const cacheKey = 'public:active';
    
    return await CacheService.getOrSet(
      cacheKey,
      async () => {
        const result = await this.listClubs({ isActive: true }, 1, 100);
        return result.clubs;
      },
      { prefix: 'club_list', ttl: 900 } // 15 minutes for public data
    );
  }

  /**
   * Get club statistics with caching
   */
  async getClubStatistics(): Promise<{
    totalClubs: number;
    activeClubs: number;
    inactiveClubs: number;
    clubsWithPresidents: number;
  }> {
    const cacheKey = 'statistics';
    
    return await CacheService.getOrSet(
      cacheKey,
      async () => {
        const [total, active, withPresidents] = await Promise.all([
          this.listClubs({}, 1, 1),
          this.listClubs({ isActive: true }, 1, 1),
          this.listClubs({}, 1, 1000) // Get all to count presidents
        ]);
        
        const clubsWithPresidentsCount = withPresidents.clubs.filter(club => club.presidentId).length;
        
        return {
          totalClubs: total.total,
          activeClubs: active.total,
          inactiveClubs: total.total - active.total,
          clubsWithPresidents: clubsWithPresidentsCount
        };
      },
      { prefix: 'club_stats', ttl: 1800 } // 30 minutes for statistics
    );
  }

  /**
   * Warm up frequently accessed club data
   */
  async warmCache(): Promise<void> {
    try {
      console.log('Warming club cache...');
      
      // Warm up active clubs list
      await this.getActiveClubsForPublic();
      
      // Warm up club statistics
      await this.getClubStatistics();
      
      // Warm up first page of all clubs
      await this.listClubs({}, 1, 20);
      
      console.log('Club cache warming completed');
    } catch (error) {
      console.error('Club cache warming failed:', error);
    }
  }

  /**
   * Invalidate all club-related caches
   */
  async invalidateAllClubCaches(): Promise<void> {
    await Promise.all([
      CacheService.invalidatePattern('club:*'),
      CacheService.invalidatePattern('club_list:*'),
      CacheService.invalidatePattern('club_access:*'),
      CacheService.invalidatePattern('club_stats:*')
    ]);
  }

  /**
   * Generate cache key for list operations
   */
  private generateListCacheKey(filters: ClubFilters, page: number, limit: number): string {
    const filterKeys = Object.keys(filters).sort();
    const filterString = filterKeys
      .map(key => `${key}:${filters[key as keyof ClubFilters]}`)
      .join('|');
    
    return `list:${filterString}:page:${page}:limit:${limit}`;
  }

  /**
   * Invalidate caches related to a specific club
   */
  private async invalidateRelatedCaches(clubId: string): Promise<void> {
    await Promise.all([
      // Invalidate club-specific caches
      CacheService.invalidatePattern(`club:${clubId}*`),
      CacheService.invalidatePattern(`club:slug:*`),
      
      // Invalidate access caches for this club
      CacheService.invalidatePattern(`club_access:${clubId}:*`),
      
      // Invalidate statistics
      CacheService.invalidatePattern('club_stats:*'),
      
      // Invalidate activity lists for this club
      CacheService.invalidatePattern(`activity_list:club:${clubId}:*`)
    ]);
  }

  /**
   * Comprehensive cache cleanup when a club is deleted
   */
  private async performClubDeletionCacheCleanup(clubId: string, club: ClubWithPresident | null): Promise<void> {
    const cleanupPromises = [
      // Remove all club-specific caches
      CacheService.invalidatePattern(`club:${clubId}*`),
      CacheService.invalidatePattern(`club:slug:*`),
      
      // Remove access caches
      CacheService.invalidatePattern(`club_access:${clubId}:*`),
      
      // Remove activity caches for this club
      CacheService.invalidatePattern(`activity:*`), // Activities might reference this club
      CacheService.invalidatePattern(`activity_list:club:${clubId}:*`),
      
      // Remove application caches for this club
      CacheService.invalidatePattern(`application:*`), // Applications might reference this club
      
      // Invalidate all lists and statistics
      ClubCacheService.invalidateClubLists(),
      CacheService.invalidatePattern('club_stats:*')
    ];

    // If club had a president, invalidate their caches too
    if (club?.presidentId) {
      cleanupPromises.push(
        CacheService.invalidatePattern(`club_list:president:${club.presidentId}*`),
        CacheService.invalidatePattern(`session:*`) // President sessions might be affected
      );
    }

    await Promise.all(cleanupPromises);
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
      const testKey = 'health_test_club';
      const testData = { id: 'test', name: 'Test Club' };
      
      await ClubCacheService.setClub(testKey, testData);
      const retrieved = await ClubCacheService.getClub(testKey);
      await ClubCacheService.invalidateClub(testKey);
      
      if (!retrieved || retrieved.name !== testData.name) {
        errors.push('Basic cache operations failed');
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
      errors.push(`Cache health check failed: ${error.message}`);
      return {
        isHealthy: false,
        stats: null,
        errors
      };
    }
  }
}

export default CachedClubService;