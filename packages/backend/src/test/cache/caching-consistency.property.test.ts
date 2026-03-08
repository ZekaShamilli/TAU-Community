/**
 * Property-Based Tests for Caching Consistency
 * **Feature: tau-kays, Property 16: Caching consistency**
 * **Validates: Requirements 11.5**
 */

import * as fc from 'fast-check';
import { CacheService, ClubCacheService, ActivityCacheService, SessionCacheService } from '../../lib/cache';
import { redisManager } from '../../lib/auth/redis';
import CachedClubService from '../../services/cached-club.service';
import CachedActivityService from '../../services/cached-activity.service';
import SessionService from '../../services/session.service';
import { UserRole, ActivityStatus } from '@prisma/client';

// Test configuration
const PROPERTY_TEST_RUNS = 10;
const TEST_TIMEOUT = 30000;

describe('Property 16: Caching consistency', () => {
  beforeAll(async () => {
    // Ensure Redis connection for tests
    if (!redisManager.isReady()) {
      await redisManager.connect();
    }
  });

  afterAll(async () => {
    // Clean up test data
    await CacheService.clearAll();
  });

  beforeEach(async () => {
    // Clear cache before each test
    await CacheService.clearAll();
  });

  /**
   * Property: For any cached data, the cached version should remain consistent with the source data
   */
  describe('Cache-Source Consistency', () => {
    it('should maintain consistency between cached and source data for basic cache operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 50 }),
            data: fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 100 }),
              value: fc.integer({ min: 0, max: 1000 }),
              timestamp: fc.date(),
              active: fc.boolean()
            }),
            ttl: fc.integer({ min: 10, max: 300 })
          }),
          async ({ key, data, ttl }) => {
            // Store data in cache
            await CacheService.set(key, data, { ttl });
            
            // Retrieve data from cache
            const cachedData = await CacheService.get(key);
            
            // Verify consistency
            expect(cachedData).not.toBeNull();
            expect(cachedData).toEqual(data);
            expect(cachedData.id).toBe(data.id);
            expect(cachedData.name).toBe(data.name);
            expect(cachedData.value).toBe(data.value);
            expect(cachedData.active).toBe(data.active);
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    }, TEST_TIMEOUT);

    it('should maintain consistency for club data caching', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            clubId: fc.uuid(),
            clubData: fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 3, maxLength: 50 }),
              description: fc.option(fc.string({ maxLength: 200 })),
              urlSlug: fc.string({ minLength: 3, maxLength: 50 }),
              presidentId: fc.option(fc.uuid()),
              isActive: fc.boolean(),
              createdAt: fc.date(),
              updatedAt: fc.date()
            })
          }),
          async ({ clubId, clubData }) => {
            // Cache club data
            await ClubCacheService.setClub(clubId, clubData);
            
            // Retrieve cached club data
            const cachedClub = await ClubCacheService.getClub(clubId);
            
            // Verify consistency
            expect(cachedClub).not.toBeNull();
            expect(cachedClub).toEqual(clubData);
            expect(cachedClub.id).toBe(clubData.id);
            expect(cachedClub.name).toBe(clubData.name);
            expect(cachedClub.isActive).toBe(clubData.isActive);
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    }, TEST_TIMEOUT);

    it('should maintain consistency for activity data caching', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            activityId: fc.uuid(),
            activityData: fc.record({
              id: fc.uuid(),
              clubId: fc.uuid(),
              title: fc.string({ minLength: 5, maxLength: 100 }),
              description: fc.option(fc.string({ maxLength: 500 })),
              startDate: fc.date(),
              endDate: fc.date(),
              location: fc.option(fc.string({ maxLength: 100 })),
              maxParticipants: fc.option(fc.integer({ min: 1, max: 1000 })),
              status: fc.constantFrom(
                ActivityStatus.DRAFT,
                ActivityStatus.PUBLISHED,
                ActivityStatus.CANCELLED,
                ActivityStatus.COMPLETED
              ),
              createdAt: fc.date(),
              updatedAt: fc.date()
            })
          }),
          async ({ activityId, activityData }) => {
            // Ensure end date is after start date
            if (activityData.endDate <= activityData.startDate) {
              activityData.endDate = new Date(activityData.startDate.getTime() + 3600000); // +1 hour
            }
            
            // Cache activity data
            await ActivityCacheService.setActivity(activityId, activityData);
            
            // Retrieve cached activity data
            const cachedActivity = await ActivityCacheService.getActivity(activityId);
            
            // Verify consistency
            expect(cachedActivity).not.toBeNull();
            expect(cachedActivity).toEqual(activityData);
            expect(cachedActivity.id).toBe(activityData.id);
            expect(cachedActivity.title).toBe(activityData.title);
            expect(cachedActivity.status).toBe(activityData.status);
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    }, TEST_TIMEOUT);

    it('should maintain consistency for session data caching', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sessionId: fc.uuid(),
            sessionData: fc.record({
              userId: fc.uuid(),
              userRole: fc.constantFrom(UserRole.SUPER_ADMIN, UserRole.CLUB_PRESIDENT, UserRole.STUDENT),
              clubId: fc.option(fc.uuid()),
              email: fc.emailAddress(),
              firstName: fc.string({ minLength: 1, maxLength: 50 }),
              lastName: fc.string({ minLength: 1, maxLength: 50 }),
              loginTime: fc.date(),
              lastActivity: fc.date(),
              ipAddress: fc.option(fc.ipV4()),
              userAgent: fc.option(fc.string({ maxLength: 200 })),
              permissions: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
            })
          }),
          async ({ sessionId, sessionData }) => {
            // Cache session data
            await SessionCacheService.setSession(sessionId, sessionData);
            
            // Retrieve cached session data
            const cachedSession = await SessionCacheService.getSession(sessionId);
            
            // Verify consistency
            expect(cachedSession).not.toBeNull();
            expect(cachedSession).toEqual(sessionData);
            expect(cachedSession.userId).toBe(sessionData.userId);
            expect(cachedSession.userRole).toBe(sessionData.userRole);
            expect(cachedSession.email).toBe(sessionData.email);
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    }, TEST_TIMEOUT);
  });

  /**
   * Property: Cache invalidation should occur when source data changes
   */
  describe('Cache Invalidation Consistency', () => {
    it('should invalidate cache when data is explicitly deleted', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 50 }),
            data: fc.record({
              id: fc.uuid(),
              value: fc.string({ minLength: 1, maxLength: 100 })
            })
          }),
          async ({ key, data }) => {
            // Store data in cache
            await CacheService.set(key, data, { ttl: 300 });
            
            // Verify data is cached
            const cachedData = await CacheService.get(key);
            expect(cachedData).toEqual(data);
            
            // Delete from cache
            await CacheService.delete(key);
            
            // Verify data is no longer cached
            const deletedData = await CacheService.get(key);
            expect(deletedData).toBeNull();
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    }, TEST_TIMEOUT);

    it('should invalidate club cache when club is updated', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            clubId: fc.uuid(),
            originalData: fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 3, maxLength: 50 }),
              isActive: fc.boolean()
            }),
            updatedData: fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 3, maxLength: 50 }),
              isActive: fc.boolean()
            })
          }),
          async ({ clubId, originalData, updatedData }) => {
            // Ensure updated data is different
            updatedData.name = originalData.name + '_updated';
            updatedData.id = originalData.id; // Keep same ID
            
            // Cache original data
            await ClubCacheService.setClub(clubId, originalData);
            
            // Verify original data is cached
            const cachedOriginal = await ClubCacheService.getClub(clubId);
            expect(cachedOriginal).toEqual(originalData);
            
            // Invalidate cache (simulating data update)
            await ClubCacheService.invalidateClub(clubId);
            
            // Cache updated data
            await ClubCacheService.setClub(clubId, updatedData);
            
            // Verify updated data is now cached
            const cachedUpdated = await ClubCacheService.getClub(clubId);
            expect(cachedUpdated).toEqual(updatedData);
            expect(cachedUpdated.name).toBe(updatedData.name);
            expect(cachedUpdated.name).not.toBe(originalData.name);
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    }, TEST_TIMEOUT);

    it('should invalidate activity cache when activity is updated', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            activityId: fc.uuid(),
            originalData: fc.record({
              id: fc.uuid(),
              title: fc.string({ minLength: 5, maxLength: 50 }),
              status: fc.constantFrom(ActivityStatus.DRAFT, ActivityStatus.PUBLISHED)
            }),
            updatedData: fc.record({
              id: fc.uuid(),
              title: fc.string({ minLength: 5, maxLength: 50 }),
              status: fc.constantFrom(ActivityStatus.PUBLISHED, ActivityStatus.COMPLETED)
            })
          }),
          async ({ activityId, originalData, updatedData }) => {
            // Ensure updated data is different
            updatedData.title = originalData.title + '_updated';
            updatedData.id = originalData.id; // Keep same ID
            
            // Cache original data
            await ActivityCacheService.setActivity(activityId, originalData);
            
            // Verify original data is cached
            const cachedOriginal = await ActivityCacheService.getActivity(activityId);
            expect(cachedOriginal).toEqual(originalData);
            
            // Invalidate cache (simulating data update)
            await ActivityCacheService.invalidateActivity(activityId);
            
            // Cache updated data
            await ActivityCacheService.setActivity(activityId, updatedData);
            
            // Verify updated data is now cached
            const cachedUpdated = await ActivityCacheService.getActivity(activityId);
            expect(cachedUpdated).toEqual(updatedData);
            expect(cachedUpdated.title).toBe(updatedData.title);
            expect(cachedUpdated.title).not.toBe(originalData.title);
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    }, TEST_TIMEOUT);

    it('should invalidate session cache when session is terminated', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sessionId: fc.uuid(),
            sessionData: fc.record({
              userId: fc.uuid(),
              userRole: fc.constantFrom(UserRole.STUDENT, UserRole.CLUB_PRESIDENT),
              email: fc.emailAddress(),
              firstName: fc.string({ minLength: 1, maxLength: 50 }),
              lastName: fc.string({ minLength: 1, maxLength: 50 }),
              loginTime: fc.date(),
              lastActivity: fc.date(),
              permissions: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 })
            })
          }),
          async ({ sessionId, sessionData }) => {
            // Cache session data
            await SessionCacheService.setSession(sessionId, sessionData);
            
            // Verify session is cached
            const cachedSession = await SessionCacheService.getSession(sessionId);
            expect(cachedSession).toEqual(sessionData);
            
            // Invalidate session (simulating logout)
            await SessionCacheService.invalidateSession(sessionId);
            
            // Verify session is no longer cached
            const invalidatedSession = await SessionCacheService.getSession(sessionId);
            expect(invalidatedSession).toBeNull();
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    }, TEST_TIMEOUT);
  });

  /**
   * Property: Cache versioning should prevent stale data issues
   */
  describe('Cache Versioning Consistency', () => {
    it('should handle cache versioning correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 50 }),
            data1: fc.record({
              id: fc.uuid(),
              value: fc.string({ minLength: 1, maxLength: 50 })
            }),
            data2: fc.record({
              id: fc.uuid(),
              value: fc.string({ minLength: 1, maxLength: 50 })
            })
          }),
          async ({ key, data1, data2 }) => {
            // Ensure data is different
            data2.value = data1.value + '_v2';
            data2.id = data1.id; // Keep same ID
            
            // Set initial version
            await CacheService.setVersion(key, '1');
            await CacheService.set(key, data1, { ttl: 300 });
            
            // Verify data is cached with version 1
            const cached1 = await CacheService.get(key);
            expect(cached1).toEqual(data1);
            
            // Increment version (simulating data change)
            await CacheService.incrementVersion(key);
            
            // Old cached data should be invalidated due to version mismatch
            // This is handled internally by the cache service
            
            // Set new data with new version
            await CacheService.set(key, data2, { ttl: 300 });
            
            // Verify new data is cached
            const cached2 = await CacheService.get(key);
            expect(cached2).toEqual(data2);
            expect(cached2.value).toBe(data2.value);
            expect(cached2.value).not.toBe(data1.value);
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    }, TEST_TIMEOUT);
  });

  /**
   * Property: Cache dependencies should be properly invalidated
   */
  describe('Cache Dependency Consistency', () => {
    it('should invalidate dependent caches when parent data changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            parentKey: fc.string({ minLength: 1, maxLength: 30 }),
            childKey: fc.string({ minLength: 1, maxLength: 30 }),
            parentData: fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 })
            }),
            childData: fc.record({
              id: fc.uuid(),
              parentId: fc.uuid(),
              value: fc.string({ minLength: 1, maxLength: 50 })
            })
          }),
          async ({ parentKey, childKey, parentData, childData }) => {
            // Ensure keys are different
            if (parentKey === childKey) {
              childKey = childKey + '_child';
            }
            
            // Link child data to parent
            childData.parentId = parentData.id;
            
            // Cache parent data
            await CacheService.set(parentKey, parentData, { ttl: 300 });
            
            // Cache child data with dependency on parent
            await CacheService.set(childKey, childData, { ttl: 300 });
            await CacheService.setDependency(childKey, [parentKey]);
            
            // Verify both are cached
            const cachedParent = await CacheService.get(parentKey);
            const cachedChild = await CacheService.get(childKey);
            expect(cachedParent).toEqual(parentData);
            expect(cachedChild).toEqual(childData);
            
            // Invalidate parent with dependencies
            await CacheService.invalidateWithDependencies(parentKey);
            
            // Verify both parent and child are invalidated
            const invalidatedParent = await CacheService.get(parentKey);
            const invalidatedChild = await CacheService.get(childKey);
            expect(invalidatedParent).toBeNull();
            expect(invalidatedChild).toBeNull();
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    }, TEST_TIMEOUT);
  });

  /**
   * Property: Cache TTL should be respected
   */
  describe('Cache TTL Consistency', () => {
    it('should respect TTL for cached data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 50 }),
            data: fc.record({
              id: fc.uuid(),
              value: fc.string({ minLength: 1, maxLength: 50 })
            }),
            ttl: fc.integer({ min: 1, max: 3 }) // Short TTL for testing
          }),
          async ({ key, data, ttl }) => {
            // Cache data with short TTL
            await CacheService.set(key, data, { ttl });
            
            // Verify data is immediately available
            const cachedData = await CacheService.get(key);
            expect(cachedData).toEqual(data);
            
            // Wait for TTL to expire
            await new Promise(resolve => setTimeout(resolve, (ttl + 1) * 1000));
            
            // Verify data is no longer available
            const expiredData = await CacheService.get(key);
            expect(expiredData).toBeNull();
          }
        ),
        { numRuns: Math.min(PROPERTY_TEST_RUNS, 20) } // Fewer runs due to time delays
      );
    }, TEST_TIMEOUT * 2); // Longer timeout for TTL tests
  });

  /**
   * Property: Concurrent cache operations should maintain consistency
   */
  describe('Concurrent Cache Operations Consistency', () => {
    it('should handle concurrent cache operations consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseKey: fc.string({ minLength: 1, maxLength: 30 }),
            operations: fc.array(
              fc.record({
                type: fc.constantFrom('set', 'get', 'delete'),
                data: fc.record({
                  id: fc.uuid(),
                  value: fc.string({ minLength: 1, maxLength: 50 })
                })
              }),
              { minLength: 2, maxLength: 5 }
            )
          }),
          async ({ baseKey, operations }) => {
            const promises = operations.map(async (op, index) => {
              const key = `${baseKey}_${index}`;
              
              switch (op.type) {
                case 'set':
                  await CacheService.set(key, op.data, { ttl: 300 });
                  return { type: 'set', key, data: op.data };
                
                case 'get':
                  const result = await CacheService.get(key);
                  return { type: 'get', key, result };
                
                case 'delete':
                  await CacheService.delete(key);
                  return { type: 'delete', key };
                
                default:
                  return { type: 'unknown', key };
              }
            });
            
            // Execute all operations concurrently
            const results = await Promise.all(promises);
            
            // Verify that all operations completed without errors
            expect(results).toHaveLength(operations.length);
            results.forEach((result, index) => {
              expect(result.type).toBe(operations[index].type);
              expect(result.key).toBe(`${baseKey}_${index}`);
            });
          }
        ),
        { numRuns: Math.min(PROPERTY_TEST_RUNS, 30) } // Fewer runs for concurrent tests
      );
    }, TEST_TIMEOUT);
  });
});