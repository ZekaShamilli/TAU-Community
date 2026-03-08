/**
 * Activity Service Tests
 * Tests for activity CRUD operations, validation, and version history
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PrismaClient, UserRole, ActivityStatus } from '@prisma/client';
import ActivityService, { CreateActivityRequest, UpdateActivityRequest } from '../../services/activity.service';
import { db } from '../../lib/database';

describe('ActivityService', () => {
  let activityService: ActivityService;
  let prisma: PrismaClient;
  let testClubId: string;
  let testUserId: string;
  let testActivityId: string;

  beforeAll(async () => {
    prisma = db.getClient();
    activityService = new ActivityService();

    // Create test user (club president)
    const testUser = await prisma.user.create({
      data: {
        email: 'test-president@tau.edu.az',
        passwordHash: 'hashed_password',
        role: UserRole.CLUB_PRESIDENT,
        firstName: 'Test',
        lastName: 'President',
        isActive: true
      }
    });
    testUserId = testUser.id;

    // Create test club
    const testClub = await prisma.club.create({
      data: {
        name: 'Test Activity Club',
        description: 'A club for testing activities',
        urlSlug: 'test-activity-club',
        presidentId: testUserId,
        isActive: true
      }
    });
    testClubId = testClub.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.activity.deleteMany({
      where: { clubId: testClubId }
    });
    await prisma.club.delete({
      where: { id: testClubId }
    });
    await prisma.user.delete({
      where: { id: testUserId }
    });
  });

  beforeEach(async () => {
    // Clean up activities before each test
    await prisma.activity.deleteMany({
      where: { clubId: testClubId }
    });
  });

  describe('createActivity', () => {
    test('should create a new activity successfully', async () => {
      const activityData: CreateActivityRequest = {
        clubId: testClubId,
        title: 'Test Workshop',
        description: 'A test workshop for learning',
        startDate: new Date('2026-12-25T10:00:00Z'),
        endDate: new Date('2026-12-25T12:00:00Z'),
        location: 'Test Room 101',
        maxParticipants: 20,
        status: ActivityStatus.DRAFT
      };

      const activity = await activityService.createActivity(
        activityData,
        testUserId,
        UserRole.CLUB_PRESIDENT
      );

      expect(activity).toBeDefined();
      expect(activity.title).toBe(activityData.title);
      expect(activity.clubId).toBe(testClubId);
      expect(activity.createdBy).toBe(testUserId);
      expect(activity.status).toBe(ActivityStatus.DRAFT);
      expect(activity.club).toBeDefined();
      expect(activity.creator).toBeDefined();

      testActivityId = activity.id;
    });

    test('should validate required fields', async () => {
      const invalidData = {
        clubId: testClubId,
        title: 'A', // Too short
        startDate: new Date('2026-12-25T10:00:00Z'),
        endDate: new Date('2026-12-25T09:00:00Z'), // Before start date
      } as CreateActivityRequest;

      await expect(
        activityService.createActivity(invalidData, testUserId, UserRole.CLUB_PRESIDENT)
      ).rejects.toThrow();
    });

    test('should validate club access', async () => {
      // Create another user who is not the president
      const otherUser = await prisma.user.create({
        data: {
          email: 'other-user@tau.edu.az',
          passwordHash: 'hashed_password',
          role: UserRole.CLUB_PRESIDENT,
          firstName: 'Other',
          lastName: 'User',
          isActive: true
        }
      });

      const activityData: CreateActivityRequest = {
        clubId: testClubId,
        title: 'Unauthorized Activity',
        startDate: new Date('2026-12-25T10:00:00Z'),
        endDate: new Date('2026-12-25T12:00:00Z'),
      };

      await expect(
        activityService.createActivity(activityData, otherUser.id, UserRole.CLUB_PRESIDENT)
      ).rejects.toThrow('Access denied');

      // Clean up
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe('updateActivity', () => {
    beforeEach(async () => {
      // Create a test activity
      const activity = await prisma.activity.create({
        data: {
          clubId: testClubId,
          title: 'Original Title',
          description: 'Original description',
          startDate: new Date('2026-12-25T10:00:00Z'),
          endDate: new Date('2026-12-25T12:00:00Z'),
          location: 'Original Location',
          maxParticipants: 15,
          createdBy: testUserId,
          status: ActivityStatus.DRAFT
        }
      });
      testActivityId = activity.id;
    });

    test('should update activity successfully', async () => {
      const updateData: UpdateActivityRequest = {
        title: 'Updated Title',
        description: 'Updated description',
        maxParticipants: 25
      };

      const updatedActivity = await activityService.updateActivity(
        testActivityId,
        updateData,
        testUserId,
        UserRole.CLUB_PRESIDENT
      );

      expect(updatedActivity.title).toBe('Updated Title');
      expect(updatedActivity.description).toBe('Updated description');
      expect(updatedActivity.maxParticipants).toBe(25);
      expect(updatedActivity.location).toBe('Original Location'); // Unchanged
    });

    test('should create version history on update', async () => {
      const updateData: UpdateActivityRequest = {
        title: 'Version History Test'
      };

      await activityService.updateActivity(
        testActivityId,
        updateData,
        testUserId,
        UserRole.CLUB_PRESIDENT
      );

      const history = await activityService.getActivityVersionHistory(testActivityId);
      
      expect(history.length).toBeGreaterThan(0);
      expect(history.some(h => h.action === 'UPDATE')).toBe(true);
    });
  });

  describe('listActivities', () => {
    beforeEach(async () => {
      // Create multiple test activities
      const activities = [
        {
          clubId: testClubId,
          title: 'First Activity',
          startDate: new Date('2026-12-20T10:00:00Z'),
          endDate: new Date('2026-12-20T12:00:00Z'),
          createdBy: testUserId,
          status: ActivityStatus.PUBLISHED
        },
        {
          clubId: testClubId,
          title: 'Second Activity',
          startDate: new Date('2026-12-25T10:00:00Z'),
          endDate: new Date('2026-12-25T12:00:00Z'),
          createdBy: testUserId,
          status: ActivityStatus.DRAFT
        }
      ];

      for (const activity of activities) {
        await prisma.activity.create({ data: activity });
      }
    });

    test('should list activities with pagination', async () => {
      const result = await activityService.listActivities({}, 1, 10);

      expect(result.activities).toBeDefined();
      expect(result.total).toBeGreaterThanOrEqual(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBeGreaterThanOrEqual(1);
    });

    test('should filter activities by club', async () => {
      const result = await activityService.listActivities({ clubId: testClubId });

      expect(result.activities.length).toBeGreaterThanOrEqual(2);
      expect(result.activities.every(a => a.clubId === testClubId)).toBe(true);
    });

    test('should filter activities by status', async () => {
      const result = await activityService.listActivities({ 
        clubId: testClubId,
        status: ActivityStatus.PUBLISHED 
      });

      expect(result.activities.length).toBeGreaterThanOrEqual(1);
      expect(result.activities.every(a => a.status === ActivityStatus.PUBLISHED)).toBe(true);
    });
  });

  describe('getClubActivities', () => {
    test('should get activities for a specific club in chronological order', async () => {
      // Create activities with different dates
      const activities = [
        {
          clubId: testClubId,
          title: 'Later Activity',
          startDate: new Date('2026-12-30T10:00:00Z'),
          endDate: new Date('2026-12-30T12:00:00Z'),
          createdBy: testUserId,
          status: ActivityStatus.PUBLISHED
        },
        {
          clubId: testClubId,
          title: 'Earlier Activity',
          startDate: new Date('2026-12-20T10:00:00Z'),
          endDate: new Date('2026-12-20T12:00:00Z'),
          createdBy: testUserId,
          status: ActivityStatus.PUBLISHED
        }
      ];

      for (const activity of activities) {
        await prisma.activity.create({ data: activity });
      }

      const clubActivities = await activityService.getClubActivities(testClubId);

      expect(clubActivities.length).toBe(2);
      expect(clubActivities[0].title).toBe('Earlier Activity');
      expect(clubActivities[1].title).toBe('Later Activity');
    });
  });

  describe('updateActivityStatuses', () => {
    test('should update past activities to completed status', async () => {
      // Create an activity that has already ended
      const pastActivity = await prisma.activity.create({
        data: {
          clubId: testClubId,
          title: 'Past Activity',
          startDate: new Date('2020-01-01T10:00:00Z'),
          endDate: new Date('2020-01-01T12:00:00Z'),
          createdBy: testUserId,
          status: ActivityStatus.PUBLISHED
        }
      });

      const updatedCount = await activityService.updateActivityStatuses();

      expect(updatedCount).toBeGreaterThanOrEqual(1);

      // Verify the activity status was updated
      const updatedActivity = await prisma.activity.findUnique({
        where: { id: pastActivity.id }
      });

      expect(updatedActivity?.status).toBe(ActivityStatus.COMPLETED);
    });
  });

  describe('validateActivityAccess', () => {
    beforeEach(async () => {
      const activity = await prisma.activity.create({
        data: {
          clubId: testClubId,
          title: 'Access Test Activity',
          startDate: new Date('2026-12-25T10:00:00Z'),
          endDate: new Date('2026-12-25T12:00:00Z'),
          createdBy: testUserId,
          status: ActivityStatus.PUBLISHED
        }
      });
      testActivityId = activity.id;
    });

    test('should allow club president to access their club activities', async () => {
      const hasAccess = await activityService.validateActivityAccess(
        testActivityId,
        testUserId,
        UserRole.CLUB_PRESIDENT,
        'READ'
      );

      expect(hasAccess).toBe(true);
    });

    test('should allow students to read published activities', async () => {
      const studentUser = await prisma.user.create({
        data: {
          email: 'student@tau.edu.az',
          passwordHash: 'hashed_password',
          role: UserRole.STUDENT,
          firstName: 'Test',
          lastName: 'Student',
          isActive: true
        }
      });

      const hasAccess = await activityService.validateActivityAccess(
        testActivityId,
        studentUser.id,
        UserRole.STUDENT,
        'READ'
      );

      expect(hasAccess).toBe(true);

      // Clean up
      await prisma.user.delete({ where: { id: studentUser.id } });
    });

    test('should deny students write access', async () => {
      const studentUser = await prisma.user.create({
        data: {
          email: 'student2@tau.edu.az',
          passwordHash: 'hashed_password',
          role: UserRole.STUDENT,
          firstName: 'Test',
          lastName: 'Student',
          isActive: true
        }
      });

      const hasAccess = await activityService.validateActivityAccess(
        testActivityId,
        studentUser.id,
        UserRole.STUDENT,
        'WRITE'
      );

      expect(hasAccess).toBe(false);

      // Clean up
      await prisma.user.delete({ where: { id: studentUser.id } });
    });
  });
});
