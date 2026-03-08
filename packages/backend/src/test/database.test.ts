/**
 * Database connection and Prisma ORM tests
 * Tests database connectivity, role-based access, and basic operations
 */

import { PrismaClient, UserRole, ActivityStatus, ApplicationStatus } from '@prisma/client';
import { db, DatabaseUtils } from '../lib/database';

// Mock tests that don't require actual database connection
describe('Database Connection and Setup (Unit Tests)', () => {
  describe('Database Manager', () => {
    test('should create database manager instance', () => {
      expect(db).toBeDefined();
      expect(typeof db.getClient).toBe('function');
      expect(typeof db.withContext).toBe('function');
    });

    test('should create role-specific clients', () => {
      const superAdminClient = db.getClient(UserRole.SUPER_ADMIN);
      const clubPresidentClient = db.getClient(UserRole.CLUB_PRESIDENT);
      const studentClient = db.getClient(UserRole.STUDENT);
      const defaultClient = db.getClient();

      expect(superAdminClient).toBeInstanceOf(PrismaClient);
      expect(clubPresidentClient).toBeInstanceOf(PrismaClient);
      expect(studentClient).toBeInstanceOf(PrismaClient);
      expect(defaultClient).toBeInstanceOf(PrismaClient);
    });

    test('should have database utility functions', () => {
      expect(typeof DatabaseUtils.generateUrlSlug).toBe('function');
      expect(typeof DatabaseUtils.updateActivityStatuses).toBe('function');
      expect(typeof DatabaseUtils.isClubPresident).toBe('function');
      expect(typeof DatabaseUtils.getPresidentClubId).toBe('function');
      expect(typeof DatabaseUtils.logAudit).toBe('function');
    });
  });

  describe('Prisma Schema Types', () => {
    test('should have correct enum values', () => {
      expect(UserRole.SUPER_ADMIN).toBe('SUPER_ADMIN');
      expect(UserRole.CLUB_PRESIDENT).toBe('CLUB_PRESIDENT');
      expect(UserRole.STUDENT).toBe('STUDENT');

      expect(ActivityStatus.DRAFT).toBe('DRAFT');
      expect(ActivityStatus.PUBLISHED).toBe('PUBLISHED');
      expect(ActivityStatus.CANCELLED).toBe('CANCELLED');
      expect(ActivityStatus.COMPLETED).toBe('COMPLETED');

      expect(ApplicationStatus.PENDING).toBe('PENDING');
      expect(ApplicationStatus.APPROVED).toBe('APPROVED');
      expect(ApplicationStatus.REJECTED).toBe('REJECTED');
    });
  });

  describe('Connection Configuration', () => {
    test('should have environment variables for different roles', () => {
      // These should be defined in the environment or have defaults
      const urls = {
        SUPER_ADMIN: process.env.DATABASE_URL_SUPER_ADMIN || process.env.DATABASE_URL,
        CLUB_PRESIDENT: process.env.DATABASE_URL_CLUB_PRESIDENT || process.env.DATABASE_URL,
        STUDENT: process.env.DATABASE_URL_STUDENT || process.env.DATABASE_URL,
        DEFAULT: process.env.DATABASE_URL,
      };

      expect(urls.DEFAULT).toBeDefined();
      expect(urls.SUPER_ADMIN).toBeDefined();
      expect(urls.CLUB_PRESIDENT).toBeDefined();
      expect(urls.STUDENT).toBeDefined();
    });
  });
});

// Integration tests that require database connection
// These will be skipped if database is not available
describe('Database Integration Tests', () => {
  let prisma: PrismaClient;
  let isDbAvailable = false;

  beforeAll(async () => {
    prisma = new PrismaClient();
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      isDbAvailable = true;
    } catch (error) {
      console.log('Database not available, skipping integration tests');
      isDbAvailable = false;
    }
  });

  afterAll(async () => {
    if (isDbAvailable) {
      await prisma.$disconnect();
    }
  });

  describe('Database Connectivity', () => {
    test('should connect to database successfully', async () => {
      if (!isDbAvailable) {
        console.log('Skipping test: Database not available');
        return;
      }

      const result = await prisma.$queryRaw`SELECT 1 as test`;
      expect(result).toEqual([{ test: 1 }]);
    });

    test('should perform health check on all connections', async () => {
      if (!isDbAvailable) {
        console.log('Skipping test: Database not available');
        return;
      }

      const healthStatus = await db.healthCheck();
      
      // At least the default connection should be healthy
      expect(Object.keys(healthStatus).length).toBeGreaterThan(0);
      expect(Object.values(healthStatus)).toContain(true);
    });
  });

  describe('Session Context Management', () => {
    test('should set and clear session context', async () => {
      if (!isDbAvailable) {
        console.log('Skipping test: Database not available');
        return;
      }

      const client = db.getClient();
      const testUserId = '11111111-1111-1111-1111-111111111111';
      const testRole = UserRole.SUPER_ADMIN;

      // Set session context
      await db.setSessionContext(client, testUserId, testRole);

      // Verify context is set
      const userIdResult = await client.$queryRaw<Array<{ current_setting: string }>>`
        SELECT current_setting('app.current_user_id', true) as current_setting
      `;
      expect(userIdResult[0]!.current_setting).toBe(testUserId);

      // Clear session context
      await db.clearSessionContext(client);

      const clearedResult = await client.$queryRaw<Array<{ current_setting: string }>>`
        SELECT current_setting('app.current_user_id', true) as current_setting
      `;
      expect(clearedResult[0]!.current_setting).toBe('');
    });

    test('should execute operations with context', async () => {
      if (!isDbAvailable) {
        console.log('Skipping test: Database not available');
        return;
      }

      const testUserId = '11111111-1111-1111-1111-111111111111';
      const testRole = UserRole.SUPER_ADMIN;

      const result = await db.withContext(testUserId, testRole, async (client) => {
        return await client.$queryRaw<Array<{ current_setting: string }>>`
          SELECT current_setting('app.current_user_id', true) as current_setting
        `;
      });

      expect(result[0]!.current_setting).toBe(testUserId);
    });
  });

  describe('Database Schema Validation', () => {
    test('should have all required tables', async () => {
      if (!isDbAvailable) {
        console.log('Skipping test: Database not available');
        return;
      }

      const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `;

      const tableNames = tables.map(t => t.tablename);
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('clubs');
      expect(tableNames).toContain('activities');
      expect(tableNames).toContain('applications');
      expect(tableNames).toContain('audit_log');
    });

    test('should have all required enum types', async () => {
      if (!isDbAvailable) {
        console.log('Skipping test: Database not available');
        return;
      }

      const enums = await prisma.$queryRaw<Array<{ typname: string }>>`
        SELECT typname FROM pg_type WHERE typtype = 'e'
      `;

      const enumNames = enums.map(e => e.typname);
      expect(enumNames).toContain('user_role');
      expect(enumNames).toContain('activity_status');
      expect(enumNames).toContain('application_status');
    });
  });

  describe('CRUD Operations', () => {
    test('should perform basic user operations', async () => {
      if (!isDbAvailable) {
        console.log('Skipping test: Database not available');
        return;
      }

      // Create user
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          passwordHash: 'hashedpassword',
          role: UserRole.STUDENT,
          firstName: 'Test',
          lastName: 'User',
        },
      });

      expect(user.id).toBeTruthy();
      expect(user.email).toBe('test@example.com');
      expect(user.role).toBe(UserRole.STUDENT);

      // Read user
      const foundUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(foundUser).toBeTruthy();

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { firstName: 'Updated' },
      });
      expect(updatedUser.firstName).toBe('Updated');

      // Delete user
      await prisma.user.delete({ where: { id: user.id } });
      const deletedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(deletedUser).toBeNull();
    });
  });
});