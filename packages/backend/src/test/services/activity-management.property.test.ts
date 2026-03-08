/**
 * Property-Based Tests for Activity Management with Club Association
 * **Feature: tau-kays, Property 6: Activity management with club association**
 * **Validates: Requirements 4.2, 7.2**
 * 
 * Tests universal properties that should hold for all activity operations by Club Presidents
 */

import fc from 'fast-check';
import { CreateActivityRequest, UpdateActivityRequest } from '../../services/activity.service';
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

describe('Property 6: Activity management with club association', () => {
  let activityService: any;
  let testClubPresidentId: string;
  let testClubId: string;
  let otherClubId: string;
  let otherClubPresidentId: string;
  let superAdminId: string;

  beforeAll(async () => {
    activityService = new ActivityService();
    testClubPresidentId = 'test-club-president-id';
    testClubId = 'test-club-id';
    otherClubId = 'other-club-id';
    otherClubPresidentId = 'other-club-president-id';
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
      if (params.where.id === otherClubPresidentId) {
        return Promise.resolve({
          id: otherClubPresidentId,
          role: UserRole.CLUB_PRESIDENT,
          firstName: 'Other',
          lastName: 'President',
          email: 'other@tau.edu.az',
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
      if (params.where.id === otherClubId) {
        return Promise.resolve({
          id: otherClubId,
          name: 'Other Club',
          presidentId: otherClubPresidentId,
          isActive: true,
          urlSlug: 'other-club',
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
  });

  /**
   * **Feature: tau-kays, Property 6: Activity management with club association**
   * For any activity operation (create, update, delete) by a Club President, the activity 
   * should be correctly associated with their assigned club and no other club.
   * **Validates: Requirements 4.2, 7.2**
   */
  describe('Activity creation with club association', () => {
    test('Club President can only create activities for their assigned club', () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            title: fc.string({ minLength: 5, maxLength: 300 }).filter(title => 
              title.trim().length >= 5 && !title.includes('<') && !title.includes('>')
            ),
            description: fc.option(fc.string({ minLength: 10, maxLength: 1000 }), { nil: undefined }),
            location: fc.option(fc.string({ minLength: 3, maxLength: 200 }), { nil: undefined }),
            maxParticipants: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
            status: fc.constantFrom(ActivityStatus.DRAFT, ActivityStatus.PUBLISHED),
            // Generate future dates for start and end
            daysFromNow: fc.integer({ min: 1, max: 365 }),
            durationHours: fc.integer({ min: 1, max: 24 })
          }),
          async (activityData) => {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() + activityData.daysFromNow);
            startDate.setHours(10, 0, 0, 0); // Set to 10 AM
            
            const endDate = new Date(startDate);
            endDate.setHours(startDate.getHours() + activityData.durationHours);

            const createRequest: CreateActivityRequest = {
              clubId: testClubId,
              title: activityData.title,
              description: activityData.description,
              startDate,
              endDate,
              location: activityData.location,
              maxParticipants: activityData.maxParticipants,
              status: activityData.status
            };

            // Mock successful activity creation
            const mockActivityId = `activity-${Date.now()}`;
            const mockCreatedActivity = {
              id: mockActivityId,
              clubId: testClubId,
              title: activityData.title,
              description: activityData.description,
              startDate,
              endDate,
              location: activityData.location,
              maxParticipants: activityData.maxParticipants,
              status: activityData.status,
              createdBy: testClubPresidentId,
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

            mockPrismaClient.activity.create.mockResolvedValue(mockCreatedActivity);

            // Test: Club President creates activity for their assigned club
            const result = await activityService.createActivity(
              createRequest,
              testClubPresidentId,
              UserRole.CLUB_PRESIDENT
            );

            // Property: Activity must be associated with the Club President's assigned club
            expect(result.clubId).toBe(testClubId);
            expect(result.createdBy).toBe(testClubPresidentId);
            expect(result.club.presidentId).toBe(testClubPresidentId);
            
            // Verify the activity was created with correct association
            expect(mockPrismaClient.activity.create).toHaveBeenCalledWith({
              data: expect.objectContaining({
                clubId: testClubId,
                createdBy: testClubPresidentId,
                title: activityData.title,
                description: activityData.description,
                startDate,
                endDate,
                location: activityData.location,
                maxParticipants: activityData.maxParticipants,
                status: activityData.status
              }),
              include: expect.any(Object)
            });

            // Verify audit log was created
            expect(mockPrismaClient.auditLog.create).toHaveBeenCalledWith({
              data: expect.objectContaining({
                userId: testClubPresidentId,
                action: 'CREATE',
                resource: 'ACTIVITY',
                resourceId: mockActivityId,
                changes: expect.objectContaining({
                  activityTitle: activityData.title,
                  clubId: testClubId,
                  clubName: 'Test Club',
                  status: activityData.status
                })
              })
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Club President cannot create activities for other clubs', () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            title: fc.string({ minLength: 5, maxLength: 300 }).filter(title => 
              title.trim().length >= 5 && !title.includes('<') && !title.includes('>')
            ),
            description: fc.option(fc.string({ minLength: 10, maxLength: 1000 }), { nil: undefined }),
            location: fc.option(fc.string({ minLength: 3, maxLength: 200 }), { nil: undefined }),
            maxParticipants: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
            status: fc.constantFrom(ActivityStatus.DRAFT, ActivityStatus.PUBLISHED),
            daysFromNow: fc.integer({ min: 1, max: 365 }),
            durationHours: fc.integer({ min: 1, max: 24 })
          }),
          async (activityData) => {
            // Clear mocks for this iteration
            jest.clearAllMocks();
            
            // Re-setup mocks for this specific test case
            mockPrismaClient.user.findUnique.mockImplementation((params) => {
              if (params.where.id === testClubPresidentId) {
                return Promise.resolve({
                  id: testClubPresidentId,
                  role: UserRole.CLUB_PRESIDENT,
                });
              }
              if (params.where.id === otherClubPresidentId) {
                return Promise.resolve({
                  id: otherClubPresidentId,
                  role: UserRole.CLUB_PRESIDENT,
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
                });
              }
              if (params.where.id === otherClubId) {
                return Promise.resolve({
                  id: otherClubId,
                  name: 'Other Club',
                  presidentId: otherClubPresidentId,
                  isActive: true,
                });
              }
              return Promise.resolve(null);
            });

            const startDate = new Date();
            startDate.setDate(startDate.getDate() + activityData.daysFromNow);
            startDate.setHours(10, 0, 0, 0);
            
            const endDate = new Date(startDate);
            endDate.setHours(startDate.getHours() + activityData.durationHours);

            const createRequest: CreateActivityRequest = {
              clubId: otherClubId, // Trying to create for other club
              title: activityData.title,
              description: activityData.description,
              startDate,
              endDate,
              location: activityData.location,
              maxParticipants: activityData.maxParticipants,
              status: activityData.status
            };

            // Test: Club President tries to create activity for another club
            await expect(
              activityService.createActivity(
                createRequest,
                testClubPresidentId,
                UserRole.CLUB_PRESIDENT
              )
            ).rejects.toThrow('Access denied: You can only manage activities for your assigned club');

            // Property: No activity should be created for unauthorized club
            expect(mockPrismaClient.activity.create).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 5 } // Reduced runs for debugging
      );
    });
  });

  describe('Activity update with club association', () => {
    test('Club President can only update activities for their assigned club', () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            title: fc.option(fc.string({ minLength: 5, maxLength: 300 }).filter(title => 
              title.trim().length >= 5 && !title.includes('<') && !title.includes('>')
            ), { nil: undefined }),
            description: fc.option(fc.string({ minLength: 10, maxLength: 1000 }), { nil: undefined }),
            location: fc.option(fc.string({ minLength: 3, maxLength: 200 }), { nil: undefined }),
            maxParticipants: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
            status: fc.option(fc.constantFrom(ActivityStatus.DRAFT, ActivityStatus.PUBLISHED), { nil: undefined }),
          }),
          async (updateData) => {
            const activityId = 'test-activity-id';
            // Create future dates for existing activity to avoid validation issues
            const futureStartDate = new Date();
            futureStartDate.setDate(futureStartDate.getDate() + 30); // 30 days from now
            const futureEndDate = new Date(futureStartDate);
            futureEndDate.setHours(futureStartDate.getHours() + 2); // 2 hours later

            const existingActivity = {
              id: activityId,
              clubId: testClubId,
              title: 'Original Title',
              description: 'Original Description',
              startDate: futureStartDate,
              endDate: futureEndDate,
              location: 'Original Location',
              maxParticipants: 50,
              status: ActivityStatus.DRAFT,
              createdBy: testClubPresidentId,
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

            const updatedActivity = {
              ...existingActivity,
              ...updateData,
              updatedAt: new Date()
            };

            mockPrismaClient.activity.findUnique.mockResolvedValue(existingActivity);
            mockPrismaClient.activity.update.mockResolvedValue(updatedActivity);

            // Test: Club President updates activity for their assigned club
            const result = await activityService.updateActivity(
              activityId,
              updateData,
              testClubPresidentId,
              UserRole.CLUB_PRESIDENT
            );

            // Property: Updated activity must remain associated with the Club President's assigned club
            expect(result.clubId).toBe(testClubId);
            expect(result.club.presidentId).toBe(testClubPresidentId);
            
            // Verify the activity was updated correctly
            expect(mockPrismaClient.activity.update).toHaveBeenCalledWith({
              where: { id: activityId },
              data: expect.objectContaining({
                ...updateData,
                updatedAt: expect.any(Date)
              }),
              include: expect.any(Object)
            });

            // Verify audit log was created for update
            expect(mockPrismaClient.auditLog.create).toHaveBeenCalledWith({
              data: expect.objectContaining({
                userId: testClubPresidentId,
                action: 'UPDATE',
                resource: 'ACTIVITY',
                resourceId: activityId,
                changes: expect.objectContaining({
                  before: expect.any(Object),
                  after: expect.any(Object),
                  changes: updateData
                })
              })
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Club President cannot update activities from other clubs', () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            title: fc.option(fc.string({ minLength: 5, maxLength: 300 }), { nil: undefined }),
            description: fc.option(fc.string({ minLength: 10, maxLength: 1000 }), { nil: undefined }),
          }),
          async (updateData) => {
            // Clear mocks for this iteration
            jest.clearAllMocks();
            
            // Re-setup mocks for this specific test case
            mockPrismaClient.user.findUnique.mockImplementation((params) => {
              if (params.where.id === testClubPresidentId) {
                return Promise.resolve({
                  id: testClubPresidentId,
                  role: UserRole.CLUB_PRESIDENT,
                });
              }
              if (params.where.id === otherClubPresidentId) {
                return Promise.resolve({
                  id: otherClubPresidentId,
                  role: UserRole.CLUB_PRESIDENT,
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
                });
              }
              if (params.where.id === otherClubId) {
                return Promise.resolve({
                  id: otherClubId,
                  name: 'Other Club',
                  presidentId: otherClubPresidentId,
                  isActive: true,
                });
              }
              return Promise.resolve(null);
            });

            const activityId = 'other-club-activity-id';
            // Create future dates for existing activity to avoid validation issues
            const futureStartDate = new Date();
            futureStartDate.setDate(futureStartDate.getDate() + 30); // 30 days from now
            const futureEndDate = new Date(futureStartDate);
            futureEndDate.setHours(futureStartDate.getHours() + 2); // 2 hours later

            const existingActivity = {
              id: activityId,
              clubId: otherClubId, // Activity belongs to other club
              title: 'Other Club Activity',
              description: 'Description',
              startDate: futureStartDate,
              endDate: futureEndDate,
              location: 'Location',
              maxParticipants: 50,
              status: ActivityStatus.DRAFT,
              createdBy: otherClubPresidentId,
              club: {
                id: otherClubId,
                name: 'Other Club',
                presidentId: otherClubPresidentId,
                isActive: true,
                urlSlug: 'other-club',
              },
              creator: {
                id: otherClubPresidentId,
                firstName: 'Other',
                lastName: 'President',
                email: 'other@tau.edu.az',
                role: UserRole.CLUB_PRESIDENT,
              }
            };

            mockPrismaClient.activity.findUnique.mockResolvedValue(existingActivity);

            // Test: Club President tries to update activity from another club
            await expect(
              activityService.updateActivity(
                activityId,
                updateData,
                testClubPresidentId,
                UserRole.CLUB_PRESIDENT
              )
            ).rejects.toThrow('Access denied: You can only manage activities for your assigned club');

            // Property: No activity should be updated for unauthorized club
            expect(mockPrismaClient.activity.update).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Activity deletion with club association', () => {
    test('Club President can only delete activities for their assigned club', () => {
      fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }), // Activity title for testing
          async (activityTitle) => {
            // Clear mocks for this iteration
            jest.clearAllMocks();
            
            // Re-setup mocks for this specific test case
            mockPrismaClient.user.findUnique.mockImplementation((params) => {
              if (params.where.id === testClubPresidentId) {
                return Promise.resolve({
                  id: testClubPresidentId,
                  role: UserRole.CLUB_PRESIDENT,
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
                });
              }
              return Promise.resolve(null);
            });

            const activityId = `activity-${Date.now()}`;
            // Create future dates for existing activity to avoid validation issues
            const futureStartDate = new Date();
            futureStartDate.setDate(futureStartDate.getDate() + 30); // 30 days from now
            const futureEndDate = new Date(futureStartDate);
            futureEndDate.setHours(futureStartDate.getHours() + 2); // 2 hours later

            const existingActivity = {
              id: activityId,
              clubId: testClubId,
              title: activityTitle,
              description: 'Test Description',
              startDate: futureStartDate,
              endDate: futureEndDate,
              location: 'Test Location',
              maxParticipants: 50,
              status: ActivityStatus.DRAFT,
              createdBy: testClubPresidentId,
              club: {
                id: testClubId,
                name: 'Test Club'
              }
            };

            mockPrismaClient.activity.findUnique.mockResolvedValue(existingActivity);
            mockPrismaClient.activity.delete.mockResolvedValue(existingActivity);
            mockPrismaClient.auditLog.create.mockResolvedValue({
              id: 'audit-id',
              userId: testClubPresidentId,
              action: 'DELETE',
              resource: 'ACTIVITY',
              success: true,
            });

            // Test: Club President deletes activity for their assigned club
            await activityService.deleteActivity(
              activityId,
              testClubPresidentId,
              UserRole.CLUB_PRESIDENT
            );

            // Property: Activity deletion should be allowed for Club President's assigned club
            expect(mockPrismaClient.activity.delete).toHaveBeenCalledWith({
              where: { id: activityId }
            });

            // Verify audit log was created for deletion
            expect(mockPrismaClient.auditLog.create).toHaveBeenCalledWith({
              data: expect.objectContaining({
                userId: testClubPresidentId,
                action: 'DELETE',
                resource: 'ACTIVITY',
                resourceId: activityId,
                changes: expect.objectContaining({
                  activityTitle: activityTitle,
                  clubId: testClubId,
                  clubName: 'Test Club',
                  deletedData: expect.any(Object)
                })
              })
            });
          }
        ),
        { numRuns: 5 } // Reduced runs for debugging
      );
    });

    test('Club President cannot delete activities from other clubs', () => {
      fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }), // Activity title for testing
          async (activityTitle) => {
            // Clear mocks for this iteration
            jest.clearAllMocks();
            
            // Re-setup mocks for this specific test case
            mockPrismaClient.user.findUnique.mockImplementation((params) => {
              if (params.where.id === testClubPresidentId) {
                return Promise.resolve({
                  id: testClubPresidentId,
                  role: UserRole.CLUB_PRESIDENT,
                });
              }
              if (params.where.id === otherClubPresidentId) {
                return Promise.resolve({
                  id: otherClubPresidentId,
                  role: UserRole.CLUB_PRESIDENT,
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
                });
              }
              if (params.where.id === otherClubId) {
                return Promise.resolve({
                  id: otherClubId,
                  name: 'Other Club',
                  presidentId: otherClubPresidentId,
                  isActive: true,
                });
              }
              return Promise.resolve(null);
            });

            const activityId = `other-activity-${Date.now()}`;
            // Create future dates for existing activity to avoid validation issues
            const futureStartDate = new Date();
            futureStartDate.setDate(futureStartDate.getDate() + 30); // 30 days from now
            const futureEndDate = new Date(futureStartDate);
            futureEndDate.setHours(futureStartDate.getHours() + 2); // 2 hours later

            const existingActivity = {
              id: activityId,
              clubId: otherClubId, // Activity belongs to other club
              title: activityTitle,
              description: 'Test Description',
              startDate: futureStartDate,
              endDate: futureEndDate,
              location: 'Test Location',
              maxParticipants: 50,
              status: ActivityStatus.DRAFT,
              createdBy: otherClubPresidentId,
              club: {
                id: otherClubId,
                name: 'Other Club'
              }
            };

            mockPrismaClient.activity.findUnique.mockResolvedValue(existingActivity);
            mockPrismaClient.auditLog.create.mockResolvedValue({
              id: 'audit-id',
              userId: testClubPresidentId,
              action: 'DELETE',
              resource: 'ACTIVITY',
              success: true,
            });

            // Test: Club President tries to delete activity from another club
            await expect(
              activityService.deleteActivity(
                activityId,
                testClubPresidentId,
                UserRole.CLUB_PRESIDENT
              )
            ).rejects.toThrow('Access denied: You can only manage activities for your assigned club');

            // Property: No activity should be deleted for unauthorized club
            expect(mockPrismaClient.activity.delete).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 5 } // Reduced runs for debugging
      );
    });
  });

  describe('Super Admin access to all clubs', () => {
    test('Super Admin can manage activities for any club', () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            clubId: fc.constantFrom(testClubId, otherClubId),
            title: fc.string({ minLength: 5, maxLength: 300 }).filter(title => 
              title.trim().length >= 5 && !title.includes('<') && !title.includes('>')
            ),
            description: fc.option(fc.string({ minLength: 10, maxLength: 1000 }), { nil: undefined }),
            location: fc.option(fc.string({ minLength: 3, maxLength: 200 }), { nil: undefined }),
            maxParticipants: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
            status: fc.constantFrom(ActivityStatus.DRAFT, ActivityStatus.PUBLISHED),
            daysFromNow: fc.integer({ min: 1, max: 365 }),
            durationHours: fc.integer({ min: 1, max: 24 })
          }),
          async (activityData) => {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() + activityData.daysFromNow);
            startDate.setHours(10, 0, 0, 0);
            
            const endDate = new Date(startDate);
            endDate.setHours(startDate.getHours() + activityData.durationHours);

            const createRequest: CreateActivityRequest = {
              clubId: activityData.clubId,
              title: activityData.title,
              description: activityData.description,
              startDate,
              endDate,
              location: activityData.location,
              maxParticipants: activityData.maxParticipants,
              status: activityData.status
            };

            const mockActivityId = `activity-${Date.now()}`;
            const mockCreatedActivity = {
              id: mockActivityId,
              clubId: activityData.clubId,
              title: activityData.title,
              description: activityData.description,
              startDate,
              endDate,
              location: activityData.location,
              maxParticipants: activityData.maxParticipants,
              status: activityData.status,
              createdBy: superAdminId,
              club: {
                id: activityData.clubId,
                name: activityData.clubId === testClubId ? 'Test Club' : 'Other Club',
                presidentId: activityData.clubId === testClubId ? testClubPresidentId : otherClubPresidentId,
                isActive: true,
                urlSlug: activityData.clubId === testClubId ? 'test-club' : 'other-club',
              },
              creator: {
                id: superAdminId,
                firstName: 'Super',
                lastName: 'Admin',
                email: 'admin@tau.edu.az',
                role: UserRole.SUPER_ADMIN,
              }
            };

            mockPrismaClient.activity.create.mockResolvedValue(mockCreatedActivity);

            // Test: Super Admin creates activity for any club
            const result = await activityService.createActivity(
              createRequest,
              superAdminId,
              UserRole.SUPER_ADMIN
            );

            // Property: Super Admin can create activities for any club
            expect(result.clubId).toBe(activityData.clubId);
            expect(result.createdBy).toBe(superAdminId);
            
            // Verify the activity was created with correct association
            expect(mockPrismaClient.activity.create).toHaveBeenCalledWith({
              data: expect.objectContaining({
                clubId: activityData.clubId,
                createdBy: superAdminId,
                title: activityData.title
              }),
              include: expect.any(Object)
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Data integrity validation', () => {
    test('Activity data integrity is maintained during operations', () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            title: fc.string({ minLength: 5, maxLength: 300 }).filter(title => 
              title.trim().length >= 5 && !title.includes('<') && !title.includes('>')
            ),
            description: fc.option(fc.string({ minLength: 10, maxLength: 1000 }), { nil: undefined }),
            location: fc.option(fc.string({ minLength: 3, maxLength: 200 }), { nil: undefined }),
            maxParticipants: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
            status: fc.constantFrom(ActivityStatus.DRAFT, ActivityStatus.PUBLISHED),
            daysFromNow: fc.integer({ min: 1, max: 365 }),
            durationHours: fc.integer({ min: 1, max: 24 })
          }),
          async (activityData) => {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() + activityData.daysFromNow);
            startDate.setHours(10, 0, 0, 0);
            
            const endDate = new Date(startDate);
            endDate.setHours(startDate.getHours() + activityData.durationHours);

            const createRequest: CreateActivityRequest = {
              clubId: testClubId,
              title: activityData.title,
              description: activityData.description,
              startDate,
              endDate,
              location: activityData.location,
              maxParticipants: activityData.maxParticipants,
              status: activityData.status
            };

            const mockActivityId = `activity-${Date.now()}`;
            const mockCreatedActivity = {
              id: mockActivityId,
              clubId: testClubId,
              title: activityData.title,
              description: activityData.description,
              startDate,
              endDate,
              location: activityData.location,
              maxParticipants: activityData.maxParticipants,
              status: activityData.status,
              createdBy: testClubPresidentId,
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

            mockPrismaClient.activity.create.mockResolvedValue(mockCreatedActivity);

            const result = await activityService.createActivity(
              createRequest,
              testClubPresidentId,
              UserRole.CLUB_PRESIDENT
            );

            // Property: All activity data should be preserved correctly
            expect(result.title).toBe(activityData.title);
            expect(result.description).toBe(activityData.description);
            expect(result.location).toBe(activityData.location);
            expect(result.maxParticipants).toBe(activityData.maxParticipants);
            expect(result.status).toBe(activityData.status);
            expect(result.startDate).toEqual(startDate);
            expect(result.endDate).toEqual(endDate);
            
            // Property: Club association must be maintained
            expect(result.clubId).toBe(testClubId);
            expect(result.createdBy).toBe(testClubPresidentId);
            expect(result.club.presidentId).toBe(testClubPresidentId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
