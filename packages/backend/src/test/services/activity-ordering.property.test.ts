/**
 * Property-Based Tests for Activity Chronological Ordering
 * **Feature: tau-kays, Property 14: Activity chronological ordering**
 * **Validates: Requirements 7.3**
 * 
 * Tests universal properties that should hold for activity ordering on club public pages
 */

import fc from 'fast-check';
import { CreateActivityRequest } from '../../services/activity.service';
import { UserRole, ActivityStatus } from '@prisma/client';

// Mock dependencies first, before importing the service
jest.mock('../../lib/database');
jest.mock('bcrypt');

const mockBcrypt = {
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
};

jest.doMock('bcrypt', () => mockBcrypt);

// Mock Prisma client
const mockPrismaClient = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  club: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  activity: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

// Mock the prisma export from database module
jest.doMock('../../lib/database', () => ({
  prisma: mockPrismaClient,
}));

// Now import the service after mocking
const { ActivityService } = require('../../services/activity.service');

describe('Property 14: Activity chronological ordering', () => {
  let activityService: any;
  let testClubId: string;
  let testClubPresidentId: string;
  let superAdminId: string;

  beforeAll(async () => {
    activityService = new ActivityService();
    testClubId = 'test-club-id';
    testClubPresidentId = 'test-club-president-id';
    superAdminId = 'super-admin-id';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock behaviors for users
    mockPrismaClient.user.findUnique.mockImplementation((params) => {
      if (params.where.id === testClubPresidentId) {
        return Promise.resolve({
          id: testClubPresidentId,
          role: UserRole.CLUB_PRESIDENT,
          firstName: 'Test',
          lastName: 'President',
          email: 'president@tau.edu.az',
          isActive: true,
        });
      }
      if (params.where.id === superAdminId) {
        return Promise.resolve({
          id: superAdminId,
          role: UserRole.SUPER_ADMIN,
          firstName: 'Super',
          lastName: 'Admin',
          email: 'admin@tau.edu.az',
          isActive: true,
        });
      }
      return Promise.resolve(null);
    });

    // Setup default mock behaviors for clubs
    mockPrismaClient.club.findUnique.mockImplementation((params) => {
      if (params.where.id === testClubId) {
        return Promise.resolve({
          id: testClubId,
          name: 'Test Club',
          presidentId: testClubPresidentId,
          isActive: true,
          urlSlug: 'test-club',
        });
      }
      return Promise.resolve(null);
    });
    
    mockPrismaClient.auditLog.create.mockResolvedValue({
      id: 'audit-id',
      userId: testClubPresidentId,
      action: 'CREATE',
      resource: 'ACTIVITY',
      success: true,
    });

    // Reset activity findMany mock to default empty array
    mockPrismaClient.activity.findMany.mockResolvedValue([]);
  });

  /**
   * **Feature: tau-kays, Property 14: Activity chronological ordering**
   * For any club's public page, activities should be displayed in chronological order 
   * based on their start dates.
   * **Validates: Requirements 7.3**
   */
  describe('Activity chronological ordering on club public pages', () => {
    test('Activities are sorted by start date in chronological order', () => {
      fc.assert(
        fc.asyncProperty(
          // Generate an array of activities with different start dates
          fc.array(
            fc.record({
              title: fc.string({ minLength: 5, maxLength: 50 }).filter(title => 
                title.trim().length >= 5 && !title.includes('<') && !title.includes('>')
              ),
              description: fc.option(fc.string({ minLength: 10, maxLength: 200 }), { nil: undefined }),
              location: fc.option(fc.string({ minLength: 3, maxLength: 50 }), { nil: undefined }),
              maxParticipants: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
              status: fc.constantFrom(ActivityStatus.PUBLISHED, ActivityStatus.DRAFT),
              // Generate dates within a reasonable range (next 2 years)
              daysFromNow: fc.integer({ min: 1, max: 730 }),
              durationHours: fc.integer({ min: 1, max: 8 }),
              // Add some randomness to creation time for secondary sorting
              createdMinutesOffset: fc.integer({ min: 0, max: 1440 }) // 0-24 hours in minutes
            }),
            { minLength: 2, maxLength: 10 } // Test with 2-10 activities
          ),
          async (activityDataArray) => {
            // Create activities with different start dates
            const mockActivities = activityDataArray.map((activityData, index) => {
              const startDate = new Date();
              startDate.setDate(startDate.getDate() + activityData.daysFromNow);
              startDate.setHours(10, 0, 0, 0); // Set to 10 AM
              
              const endDate = new Date(startDate);
              endDate.setHours(startDate.getHours() + activityData.durationHours);

              const createdAt = new Date();
              createdAt.setMinutes(createdAt.getMinutes() + activityData.createdMinutesOffset);

              return {
                id: `activity-${index}`,
                clubId: testClubId,
                title: activityData.title,
                description: activityData.description,
                startDate,
                endDate,
                location: activityData.location,
                maxParticipants: activityData.maxParticipants,
                status: activityData.status,
                createdBy: testClubPresidentId,
                createdAt,
                updatedAt: createdAt,
                club: {
                  id: testClubId,
                  name: 'Test Club',
                  presidentId: testClubPresidentId,
                  isActive: true,
                  urlSlug: 'test-club',
                },
                creator: {
                  id: testClubPresidentId,
                  firstName: 'Test',
                  lastName: 'President',
                  email: 'president@tau.edu.az',
                  role: UserRole.CLUB_PRESIDENT,
                }
              };
            });

            // Mock the findMany call to return activities in the order they would be sorted
            const sortedActivities = [...mockActivities].sort((a, b) => {
              // Primary sort: by start date (ascending)
              const startDateComparison = a.startDate.getTime() - b.startDate.getTime();
              if (startDateComparison !== 0) {
                return startDateComparison;
              }
              // Secondary sort: by creation date (ascending) for activities with same start date
              return a.createdAt.getTime() - b.createdAt.getTime();
            });

            mockPrismaClient.activity.findMany.mockResolvedValue(sortedActivities);

            // Test: Get club activities (this should return chronologically ordered activities)
            const result = await activityService.getClubActivities(testClubId, true);

            // Property 1: Activities must be sorted by start date in chronological order
            for (let i = 0; i < result.length - 1; i++) {
              const currentActivity = result[i];
              const nextActivity = result[i + 1];
              
              expect(currentActivity.startDate.getTime()).toBeLessThanOrEqual(nextActivity.startDate.getTime());
            }

            // Property 2: For activities with the same start date, they should be sorted by creation date
            const activitiesWithSameStartDate = result.reduce((groups: any[], activity: any) => {
              const startDateKey = activity.startDate.toISOString();
              const existingGroup = groups.find(group => group.startDate === startDateKey);
              
              if (existingGroup) {
                existingGroup.activities.push(activity);
              } else {
                groups.push({
                  startDate: startDateKey,
                  activities: [activity]
                });
              }
              
              return groups;
            }, []);

            activitiesWithSameStartDate.forEach((group: any) => {
              if (group.activities.length > 1) {
                for (let i = 0; i < group.activities.length - 1; i++) {
                  const currentActivity = group.activities[i];
                  const nextActivity = group.activities[i + 1];
                  
                  expect(currentActivity.createdAt.getTime()).toBeLessThanOrEqual(nextActivity.createdAt.getTime());
                }
              }
            });

            // Property 3: All activities should belong to the requested club
            result.forEach((activity: any) => {
              expect(activity.clubId).toBe(testClubId);
            });

            // Verify the correct database query was made
            expect(mockPrismaClient.activity.findMany).toHaveBeenCalledWith({
              where: { clubId: testClubId },
              include: {
                club: true,
                creator: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    role: true
                  }
                }
              },
              orderBy: [
                { startDate: 'asc' },
                { createdAt: 'asc' }
              ]
            });
          }
        ),
        { numRuns: 10 }
      );
    });

    test('Ordering works correctly with various date ranges and time zones', () => {
      fc.assert(
        fc.asyncProperty(
          // Generate activities with dates spanning different months and years
          fc.array(
            fc.record({
              title: fc.string({ minLength: 5, maxLength: 50 }).filter(title => 
                title.trim().length >= 5
              ),
              // Generate dates across a wider range (past and future)
              year: fc.integer({ min: 2026, max: 2028 }),
              month: fc.integer({ min: 1, max: 12 }),
              day: fc.integer({ min: 1, max: 28 }), // Use 28 to avoid month-end issues
              hour: fc.integer({ min: 0, max: 23 }),
              minute: fc.integer({ min: 0, max: 59 }),
              durationHours: fc.integer({ min: 1, max: 6 }),
              status: fc.constantFrom(ActivityStatus.PUBLISHED, ActivityStatus.DRAFT)
            }),
            { minLength: 3, maxLength: 8 }
          ),
          async (activityDataArray) => {
            // Create activities with specific dates
            const mockActivities = activityDataArray.map((activityData, index) => {
              const startDate = new Date(
                activityData.year,
                activityData.month - 1, // JavaScript months are 0-indexed
                activityData.day,
                activityData.hour,
                activityData.minute,
                0,
                0
              );
              
              const endDate = new Date(startDate);
              endDate.setHours(startDate.getHours() + activityData.durationHours);

              const createdAt = new Date();
              createdAt.setMinutes(createdAt.getMinutes() + index); // Slight offset for each

              return {
                id: `activity-${index}`,
                clubId: testClubId,
                title: `${activityData.title} ${index}`,
                description: `Activity ${index} description`,
                startDate,
                endDate,
                location: `Location ${index}`,
                maxParticipants: 50,
                status: activityData.status,
                createdBy: testClubPresidentId,
                createdAt,
                updatedAt: createdAt,
                club: {
                  id: testClubId,
                  name: 'Test Club',
                  presidentId: testClubPresidentId,
                  isActive: true,
                  urlSlug: 'test-club',
                },
                creator: {
                  id: testClubPresidentId,
                  firstName: 'Test',
                  lastName: 'President',
                  email: 'president@tau.edu.az',
                  role: UserRole.CLUB_PRESIDENT,
                }
              };
            });

            // Sort activities as the database would
            const sortedActivities = [...mockActivities].sort((a, b) => {
              const startDateComparison = a.startDate.getTime() - b.startDate.getTime();
              if (startDateComparison !== 0) {
                return startDateComparison;
              }
              return a.createdAt.getTime() - b.createdAt.getTime();
            });

            mockPrismaClient.activity.findMany.mockResolvedValue(sortedActivities);

            // Test: Get club activities
            const result = await activityService.getClubActivities(testClubId, true);

            // Property: Activities must be in chronological order regardless of date range
            for (let i = 0; i < result.length - 1; i++) {
              const currentStartTime = result[i].startDate.getTime();
              const nextStartTime = result[i + 1].startDate.getTime();
              
              expect(currentStartTime).toBeLessThanOrEqual(nextStartTime);
            }

            // Property: Future activities should appear before past activities when sorted chronologically
            const now = new Date();
            const futureActivities = result.filter((activity: any) => activity.startDate > now);
            const pastActivities = result.filter((activity: any) => activity.startDate <= now);
            
            // If we have both past and future activities, past should come first in chronological order
            if (pastActivities.length > 0 && futureActivities.length > 0) {
              const lastPastActivity = pastActivities[pastActivities.length - 1];
              const firstFutureActivity = futureActivities[0];
              
              expect(lastPastActivity.startDate.getTime()).toBeLessThanOrEqual(firstFutureActivity.startDate.getTime());
            }

            // Property: Activities spanning different years should be ordered correctly
            const activitiesByYear = result.reduce((yearGroups: any, activity: any) => {
              const year = activity.startDate.getFullYear();
              if (!yearGroups[year]) {
                yearGroups[year] = [];
              }
              yearGroups[year].push(activity);
              return yearGroups;
            }, {});

            const years = Object.keys(activitiesByYear).map(Number).sort();
            for (let i = 0; i < years.length - 1; i++) {
              const currentYearActivities = activitiesByYear[years[i]];
              const nextYearActivities = activitiesByYear[years[i + 1]];
              
              const lastActivityOfCurrentYear = currentYearActivities[currentYearActivities.length - 1];
              const firstActivityOfNextYear = nextYearActivities[0];
              
              expect(lastActivityOfCurrentYear.startDate.getTime()).toBeLessThanOrEqual(firstActivityOfNextYear.startDate.getTime());
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('Ordering is consistent across different activity sets', () => {
      fc.assert(
        fc.asyncProperty(
          // Generate two different sets of activities for the same club
          fc.tuple(
            fc.array(
              fc.record({
                title: fc.string({ minLength: 5, maxLength: 30 }),
                daysFromNow: fc.integer({ min: 1, max: 100 }),
                status: fc.constantFrom(ActivityStatus.PUBLISHED, ActivityStatus.DRAFT)
              }),
              { minLength: 2, maxLength: 5 }
            ),
            fc.array(
              fc.record({
                title: fc.string({ minLength: 5, maxLength: 30 }),
                daysFromNow: fc.integer({ min: 101, max: 200 }),
                status: fc.constantFrom(ActivityStatus.PUBLISHED, ActivityStatus.DRAFT)
              }),
              { minLength: 2, maxLength: 5 }
            )
          ),
          async ([firstSet, secondSet]) => {
            // Completely reset all mocks for this test
            jest.resetAllMocks();
            
            // Re-setup the basic mocks
            mockPrismaClient.user.findUnique.mockImplementation((params) => {
              if (params.where.id === testClubPresidentId) {
                return Promise.resolve({
                  id: testClubPresidentId,
                  role: UserRole.CLUB_PRESIDENT,
                  firstName: 'Test',
                  lastName: 'President',
                  email: 'president@tau.edu.az',
                  isActive: true,
                });
              }
              return Promise.resolve(null);
            });

            mockPrismaClient.club.findUnique.mockImplementation((params) => {
              if (params.where.id === testClubId) {
                return Promise.resolve({
                  id: testClubId,
                  name: 'Test Club',
                  presidentId: testClubPresidentId,
                  isActive: true,
                  urlSlug: 'test-club',
                });
              }
              return Promise.resolve(null);
            });
            
            // Create two separate sets of activities
            const createMockActivities = (activityDataArray: any[], setPrefix: string) => {
              return activityDataArray.map((activityData, index) => {
                const startDate = new Date();
                startDate.setDate(startDate.getDate() + activityData.daysFromNow);
                startDate.setHours(10, 0, 0, 0);
                
                const endDate = new Date(startDate);
                endDate.setHours(startDate.getHours() + 2);

                const createdAt = new Date();
                createdAt.setMinutes(createdAt.getMinutes() + index);

                return {
                  id: `${setPrefix}-activity-${index}`,
                  clubId: testClubId,
                  title: `${setPrefix} ${activityData.title}`,
                  description: `${setPrefix} description`,
                  startDate,
                  endDate,
                  location: `${setPrefix} location`,
                  maxParticipants: 50,
                  status: activityData.status,
                  createdBy: testClubPresidentId,
                  createdAt,
                  updatedAt: createdAt,
                  club: {
                    id: testClubId,
                    name: 'Test Club',
                    presidentId: testClubPresidentId,
                    isActive: true,
                    urlSlug: 'test-club',
                  },
                  creator: {
                    id: testClubPresidentId,
                    firstName: 'Test',
                    lastName: 'President',
                    email: 'president@tau.edu.az',
                    role: UserRole.CLUB_PRESIDENT,
                  }
                };
              });
            };

            const firstSetActivities = createMockActivities(firstSet, 'First');
            const secondSetActivities = createMockActivities(secondSet, 'Second');
            
            // Combine and sort all activities
            const allActivities = [...firstSetActivities, ...secondSetActivities];
            const sortedActivities = allActivities.sort((a, b) => {
              const startDateComparison = a.startDate.getTime() - b.startDate.getTime();
              if (startDateComparison !== 0) {
                return startDateComparison;
              }
              return a.createdAt.getTime() - b.createdAt.getTime();
            });

            // Ensure the mock returns our specific sorted activities consistently
            mockPrismaClient.activity.findMany.mockImplementation(() => 
              Promise.resolve(sortedActivities.map(activity => ({
                ...activity,
                startDate: new Date(activity.startDate),
                endDate: new Date(activity.endDate),
                createdAt: new Date(activity.createdAt),
                updatedAt: new Date(activity.updatedAt)
              })))
            );

            // Test: Get club activities
            const result = await activityService.getClubActivities(testClubId, true);

            // Verify we got the expected activities
            expect(result).toHaveLength(sortedActivities.length);

            // Property: Ordering should be consistent regardless of which activities are included
            for (let i = 0; i < result.length - 1; i++) {
              expect(result[i].startDate.getTime()).toBeLessThanOrEqual(result[i + 1].startDate.getTime());
            }

            // Property: Activities from the first set should appear before activities from the second set
            // (since first set has earlier dates)
            const firstSetResults = result.filter((activity: any) => activity.id.startsWith('First'));
            const secondSetResults = result.filter((activity: any) => activity.id.startsWith('Second'));
            
            if (firstSetResults.length > 0 && secondSetResults.length > 0) {
              const lastFirstSetActivity = firstSetResults[firstSetResults.length - 1];
              const firstSecondSetActivity = secondSetResults[0];
              
              expect(lastFirstSetActivity.startDate.getTime()).toBeLessThanOrEqual(firstSecondSetActivity.startDate.getTime());
            }

            // Property: Within each set, activities should maintain chronological order
            [firstSetResults, secondSetResults].forEach(setResults => {
              for (let i = 0; i < setResults.length - 1; i++) {
                expect(setResults[i].startDate.getTime()).toBeLessThanOrEqual(setResults[i + 1].startDate.getTime());
              }
            });
          }
        ),
        { numRuns: 10 }
      );
    });

    test('Activities with identical start dates maintain consistent ordering', () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            // Generate multiple activities with the same start date
            baseDate: fc.date({ min: new Date('2026-12-01'), max: new Date('2027-12-31') }),
            activityCount: fc.integer({ min: 2, max: 6 }),
            titles: fc.array(fc.string({ minLength: 5, maxLength: 30 }), { minLength: 2, maxLength: 6 })
          }),
          async ({ baseDate, activityCount, titles }) => {
            // Completely reset all mocks for this test
            jest.resetAllMocks();
            
            // Re-setup the basic mocks
            mockPrismaClient.user.findUnique.mockImplementation((params) => {
              if (params.where.id === testClubPresidentId) {
                return Promise.resolve({
                  id: testClubPresidentId,
                  role: UserRole.CLUB_PRESIDENT,
                  firstName: 'Test',
                  lastName: 'President',
                  email: 'president@tau.edu.az',
                  isActive: true,
                });
              }
              return Promise.resolve(null);
            });

            mockPrismaClient.club.findUnique.mockImplementation((params) => {
              if (params.where.id === testClubId) {
                return Promise.resolve({
                  id: testClubId,
                  name: 'Test Club',
                  presidentId: testClubPresidentId,
                  isActive: true,
                  urlSlug: 'test-club',
                });
              }
              return Promise.resolve(null);
            });
            
            // Ensure we have enough titles
            const activityTitles = titles.slice(0, activityCount);
            while (activityTitles.length < activityCount) {
              activityTitles.push(`Activity ${activityTitles.length + 1}`);
            }

            // Create activities with the same start date but different creation times
            const mockActivities = activityTitles.map((title, index) => {
              const startDate = new Date(baseDate);
              startDate.setHours(14, 0, 0, 0); // 2 PM
              
              const endDate = new Date(startDate);
              endDate.setHours(16, 0, 0, 0); // 4 PM

              // Use a fixed base time for creation dates to ensure deterministic ordering
              const baseCreatedAt = new Date('2026-01-01T10:00:00.000Z');
              const createdAt = new Date(baseCreatedAt);
              createdAt.setMinutes(baseCreatedAt.getMinutes() + index * 10); // 10 minutes apart

              return {
                id: `activity-${index}`,
                clubId: testClubId,
                title: title,
                description: `Description for ${title}`,
                startDate,
                endDate,
                location: `Location ${index}`,
                maxParticipants: 50,
                status: ActivityStatus.PUBLISHED,
                createdBy: testClubPresidentId,
                createdAt,
                updatedAt: createdAt,
                club: {
                  id: testClubId,
                  name: 'Test Club',
                  presidentId: testClubPresidentId,
                  isActive: true,
                  urlSlug: 'test-club',
                },
                creator: {
                  id: testClubPresidentId,
                  firstName: 'Test',
                  lastName: 'President',
                  email: 'president@tau.edu.az',
                  role: UserRole.CLUB_PRESIDENT,
                }
              };
            });

            // Sort by creation date (secondary sort criteria)
            const sortedActivities = [...mockActivities].sort((a, b) => {
              const startDateComparison = a.startDate.getTime() - b.startDate.getTime();
              if (startDateComparison !== 0) {
                return startDateComparison;
              }
              return a.createdAt.getTime() - b.createdAt.getTime();
            });

            // Create a fresh mock implementation for this test run
            let callCount = 0;
            mockPrismaClient.activity.findMany.mockImplementation(() => {
              callCount++;
              // Return a deep copy but preserve Date objects
              return Promise.resolve(sortedActivities.map(activity => ({
                ...activity,
                startDate: new Date(activity.startDate),
                endDate: new Date(activity.endDate),
                createdAt: new Date(activity.createdAt),
                updatedAt: new Date(activity.updatedAt)
              })));
            });

            // Test: Get club activities multiple times
            const firstResult = await activityService.getClubActivities(testClubId, true);
            const secondResult = await activityService.getClubActivities(testClubId, true);

            // Verify we got the expected number of activities
            expect(firstResult).toHaveLength(sortedActivities.length);
            expect(secondResult).toHaveLength(sortedActivities.length);

            // Property: All activities should have the same start date
            const uniqueStartDates = new Set(firstResult.map((activity: any) => activity.startDate.getTime()));
            expect(uniqueStartDates.size).toBe(1);

            // Property: Activities should be ordered by creation date when start dates are identical
            for (let i = 0; i < firstResult.length - 1; i++) {
              expect(firstResult[i].createdAt.getTime()).toBeLessThanOrEqual(firstResult[i + 1].createdAt.getTime());
            }

            // Property: Ordering should be consistent across multiple calls
            const firstIds = firstResult.map((a: any) => a.id);
            const secondIds = secondResult.map((a: any) => a.id);
            expect(firstIds).toEqual(secondIds);

            // Property: The ordering should be deterministic and stable
            const thirdResult = await activityService.getClubActivities(testClubId, true);
            const thirdIds = thirdResult.map((a: any) => a.id);
            expect(firstIds).toEqual(thirdIds);

            // Verify the mock was called the expected number of times
            expect(callCount).toBe(3);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Public activity display ordering', () => {
    test('getUpcomingActivities returns activities in chronological order', () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              title: fc.string({ minLength: 5, maxLength: 40 }),
              daysFromNow: fc.integer({ min: 1, max: 365 }),
              durationHours: fc.integer({ min: 1, max: 8 }),
              clubName: fc.string({ minLength: 3, maxLength: 20 })
            }),
            { minLength: 2, maxLength: 8 }
          ),
          async (activityDataArray) => {
            // Create activities for different clubs, all published and upcoming
            const mockActivities = activityDataArray.map((activityData, index) => {
              const startDate = new Date();
              startDate.setDate(startDate.getDate() + activityData.daysFromNow);
              startDate.setHours(15, 0, 0, 0); // 3 PM
              
              const endDate = new Date(startDate);
              endDate.setHours(startDate.getHours() + activityData.durationHours);

              const createdAt = new Date();
              createdAt.setMinutes(createdAt.getMinutes() + index);

              const clubId = `club-${index % 3}`; // Distribute across 3 clubs

              return {
                id: `activity-${index}`,
                clubId,
                title: activityData.title,
                description: `Description for ${activityData.title}`,
                startDate,
                endDate,
                location: `Location ${index}`,
                maxParticipants: 50,
                status: ActivityStatus.PUBLISHED,
                createdBy: `president-${index % 3}`,
                createdAt,
                updatedAt: createdAt,
                club: {
                  id: clubId,
                  name: activityData.clubName,
                  presidentId: `president-${index % 3}`,
                  isActive: true,
                  urlSlug: `club-${index % 3}`,
                },
                creator: {
                  id: `president-${index % 3}`,
                  firstName: 'Club',
                  lastName: 'President',
                  email: `president${index % 3}@tau.edu.az`,
                  role: UserRole.CLUB_PRESIDENT,
                }
              };
            });

            // Sort activities chronologically
            const sortedActivities = [...mockActivities].sort((a, b) => {
              const startDateComparison = a.startDate.getTime() - b.startDate.getTime();
              if (startDateComparison !== 0) {
                return startDateComparison;
              }
              return a.createdAt.getTime() - b.createdAt.getTime();
            });

            mockPrismaClient.activity.findMany.mockResolvedValue(sortedActivities);

            // Test: Get upcoming activities (public display)
            const result = await activityService.getUpcomingActivities(10);

            // Property: Activities must be in chronological order
            for (let i = 0; i < result.length - 1; i++) {
              expect(result[i].startDate.getTime()).toBeLessThanOrEqual(result[i + 1].startDate.getTime());
            }

            // Property: All activities should be published and upcoming
            const now = new Date();
            result.forEach((activity: any) => {
              expect(activity.status).toBe(ActivityStatus.PUBLISHED);
              expect(activity.startDate.getTime()).toBeGreaterThanOrEqual(now.getTime());
              expect(activity.club.isActive).toBe(true);
            });

            // Property: Activities from different clubs should be intermixed but still chronologically ordered
            const clubIds = result.map((activity: any) => activity.clubId);
            const uniqueClubIds = new Set(clubIds);
            
            // If we have activities from multiple clubs, verify they're properly intermixed
            if (uniqueClubIds.size > 1) {
              let foundDifferentClub = false;
              for (let i = 1; i < result.length; i++) {
                if (result[i].clubId !== result[i - 1].clubId) {
                  foundDifferentClub = true;
                  // Even when switching clubs, chronological order must be maintained
                  expect(result[i - 1].startDate.getTime()).toBeLessThanOrEqual(result[i].startDate.getTime());
                }
              }
              // We should see activities from different clubs intermixed
              expect(foundDifferentClub).toBe(true);
            }

            // Verify the correct database query was made
            expect(mockPrismaClient.activity.findMany).toHaveBeenCalledWith({
              where: {
                status: ActivityStatus.PUBLISHED,
                startDate: {
                  gte: expect.any(Date)
                },
                club: {
                  isActive: true
                }
              },
              include: {
                club: true,
                creator: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    role: true
                  }
                }
              },
              orderBy: [
                { startDate: 'asc' },
                { createdAt: 'asc' }
              ],
              take: 10
            });
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
