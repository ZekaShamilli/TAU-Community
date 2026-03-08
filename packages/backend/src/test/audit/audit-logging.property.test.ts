/**
 * Property-Based Tests for Comprehensive Audit Logging
 * **Feature: tau-kays, Property 9: Comprehensive audit logging**
 * **Validates: Requirements 9.1, 9.2, 9.3**
 */

import fc from 'fast-check';
import { UserRole } from '@prisma/client';

// Mock Prisma client for testing
const mockPrismaClient = {
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    deleteMany: jest.fn(),
  },
};

// Mock the database module
jest.mock('../../lib/database', () => ({
  db: {
    getClient: () => mockPrismaClient,
  },
  DatabaseUtils: {
    logAudit: jest.fn(),
  },
}));

// Import after mocking
import { auditService, AuditAction } from '../../services/audit.service';

describe('Property 9: Comprehensive audit logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property: All user actions must be logged with timestamps and user identification
   * **Validates: Requirements 9.1**
   */
  test('should log all user actions with complete metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random audit actions
        fc.record({
          userId: fc.option(fc.uuid(), { nil: undefined }),
          userRole: fc.constantFrom(UserRole.SUPER_ADMIN, UserRole.CLUB_PRESIDENT, UserRole.STUDENT),
          action: fc.stringOf(fc.char().filter(c => !!c.match(/[A-Z_]/)), { minLength: 1, maxLength: 50 }),
          resource: fc.stringOf(fc.char().filter(c => !!c.match(/[A-Z_]/)), { minLength: 1, maxLength: 50 }),
          resourceId: fc.option(fc.uuid(), { nil: undefined }),
          ipAddress: fc.option(fc.ipV4(), { nil: undefined }),
          userAgent: fc.option(fc.string({ minLength: 10, maxLength: 200 }), { nil: undefined }),
          success: fc.boolean(),
          errorMessage: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
        }),
        async (auditAction: AuditAction) => {
          // Mock successful database creation
          mockPrismaClient.auditLog.create.mockResolvedValue({
            id: 'test-audit-id',
            ...auditAction,
            timestamp: new Date(),
          });
          
          // Log the action
          await auditService.logAction(auditAction);
          
          // Verify the audit log was created with correct data
          expect(mockPrismaClient.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
              userId: auditAction.userId,
              userRole: auditAction.userRole,
              action: auditAction.action,
              resource: auditAction.resource,
              resourceId: auditAction.resourceId,
              ipAddress: auditAction.ipAddress,
              userAgent: auditAction.userAgent,
              success: auditAction.success ?? true,
              errorMessage: auditAction.errorMessage,
            }),
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Content changes must track before/after states for audit purposes
   * **Validates: Requirements 9.2**
   */
  test('should track before and after states for content changes', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random before/after states
        fc.record({
          userId: fc.uuid(),
          userRole: fc.constantFrom(UserRole.SUPER_ADMIN, UserRole.CLUB_PRESIDENT),
          action: fc.constantFrom('UPDATE_CLUB', 'UPDATE_ACTIVITY', 'UPDATE_APPLICATION'),
          resource: fc.constantFrom('CLUB', 'ACTIVITY', 'APPLICATION'),
          resourceId: fc.uuid(),
          beforeState: fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 3, maxLength: 100 }),
            description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
            isActive: fc.boolean(),
            updatedAt: fc.date(),
          }),
          afterState: fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 3, maxLength: 100 }),
            description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
            isActive: fc.boolean(),
            updatedAt: fc.date(),
          }),
        }),
        async (auditData) => {
          // Mock successful database creation
          mockPrismaClient.auditLog.create.mockResolvedValue({
            id: 'test-audit-id',
            ...auditData,
            timestamp: new Date(),
          });
          
          // Log the action with before/after states
          await auditService.logAction(auditData);
          
          // Verify the audit log was created with before/after states
          expect(mockPrismaClient.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
              userId: auditData.userId,
              userRole: auditData.userRole,
              action: auditData.action,
              resource: auditData.resource,
              resourceId: auditData.resourceId,
              changes: expect.objectContaining({
                before: auditData.beforeState,
                after: auditData.afterState,
                diff: expect.any(Object),
              }),
            }),
          });
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Audit logs must be searchable and accessible to Super Admins
   * **Validates: Requirements 9.3**
   */
  test('should provide searchable audit logs with proper filtering', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate search parameters
        fc.record({
          userId: fc.option(fc.uuid(), { nil: undefined }),
          userRole: fc.option(fc.constantFrom(UserRole.SUPER_ADMIN, UserRole.CLUB_PRESIDENT, UserRole.STUDENT), { nil: undefined }),
          action: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          resource: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          success: fc.option(fc.boolean(), { nil: undefined }),
          limit: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          offset: fc.option(fc.integer({ min: 0, max: 50 }), { nil: undefined }),
        }),
        async (filters) => {
          // Mock database response
          const mockAuditEntries = [
            {
              id: 'audit-1',
              userId: filters.userId || 'user-1',
              userRole: filters.userRole || UserRole.SUPER_ADMIN,
              action: filters.action || 'CREATE_CLUB',
              resource: filters.resource || 'CLUB',
              resourceId: 'resource-1',
              changes: null,
              ipAddress: '192.168.1.1',
              userAgent: 'Test Agent',
              timestamp: new Date(),
              success: filters.success ?? true,
              errorMessage: null,
              user: {
                id: 'user-1',
                email: 'test@example.com',
                firstName: 'Test',
                lastName: 'User',
                role: UserRole.SUPER_ADMIN,
              },
            },
          ];

          mockPrismaClient.auditLog.findMany.mockResolvedValue(mockAuditEntries);
          
          // Get audit logs with filters
          const result = await auditService.getAuditLog(filters);
          
          // Verify the database was queried with correct filters
          expect(mockPrismaClient.auditLog.findMany).toHaveBeenCalledWith({
            where: expect.objectContaining(
              Object.fromEntries(
                Object.entries({
                  userId: filters.userId,
                  userRole: filters.userRole,
                  action: filters.action ? { contains: filters.action, mode: 'insensitive' } : undefined,
                  resource: filters.resource ? { contains: filters.resource, mode: 'insensitive' } : undefined,
                  success: filters.success,
                }).filter(([_, value]) => value !== undefined)
              )
            ),
            orderBy: { timestamp: 'desc' },
            take: filters.limit || 100,
            skip: filters.offset || 0,
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          });
          
          // Verify the result structure
          expect(result).toHaveLength(1);
          expect(result[0]).toMatchObject({
            id: 'audit-1',
            userId: expect.any(String),
            userRole: expect.any(String),
            action: expect.any(String),
            resource: expect.any(String),
            timestamp: expect.any(Date),
            success: expect.any(Boolean),
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Audit search functionality should work with text queries
   */
  test('should support text-based search across audit logs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          query: fc.string({ minLength: 1, maxLength: 50 }),
          limit: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          offset: fc.option(fc.integer({ min: 0, max: 50 }), { nil: undefined }),
        }),
        async (searchParams) => {
          // Mock database response
          const mockSearchResults = [
            {
              id: 'search-result-1',
              userId: 'user-1',
              userRole: UserRole.SUPER_ADMIN,
              action: 'CREATE_CLUB',
              resource: 'CLUB',
              resourceId: 'club-1',
              changes: null,
              ipAddress: '192.168.1.1',
              userAgent: 'Test Agent',
              timestamp: new Date(),
              success: true,
              errorMessage: null,
              user: {
                id: 'user-1',
                email: 'test@example.com',
                firstName: 'Test',
                lastName: 'User',
                role: UserRole.SUPER_ADMIN,
              },
            },
          ];

          mockPrismaClient.auditLog.findMany.mockResolvedValue(mockSearchResults);
          
          // Perform search
          const result = await auditService.searchAuditLog(searchParams);
          
          // Verify the database was queried with search conditions
          expect(mockPrismaClient.auditLog.findMany).toHaveBeenCalledWith({
            where: {
              OR: [
                { action: { contains: searchParams.query, mode: 'insensitive' } },
                { resource: { contains: searchParams.query, mode: 'insensitive' } },
                { errorMessage: { contains: searchParams.query, mode: 'insensitive' } },
              ],
            },
            orderBy: { timestamp: 'desc' },
            take: searchParams.limit || 100,
            skip: searchParams.offset || 0,
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          });
          
          // Verify the result structure
          expect(result).toHaveLength(1);
          expect(result[0]).toMatchObject({
            id: 'search-result-1',
            action: 'CREATE_CLUB',
            resource: 'CLUB',
          });
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property: Audit statistics should provide accurate aggregated data
   */
  test('should calculate accurate audit statistics', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          totalEntries: fc.integer({ min: 0, max: 1000 }),
          successCount: fc.integer({ min: 0, max: 1000 }),
        }),
        async (statsData) => {
          // Mock database responses for statistics
          mockPrismaClient.auditLog.count
            .mockResolvedValueOnce(statsData.totalEntries) // Total count
            .mockResolvedValueOnce(statsData.successCount); // Success count

          mockPrismaClient.auditLog.groupBy
            .mockResolvedValueOnce([ // Role stats
              { userRole: UserRole.SUPER_ADMIN, _count: { id: 10 } },
              { userRole: UserRole.CLUB_PRESIDENT, _count: { id: 20 } },
              { userRole: UserRole.STUDENT, _count: { id: 30 } },
            ])
            .mockResolvedValueOnce([ // Action stats
              { action: 'CREATE_CLUB', _count: { id: 15 } },
              { action: 'UPDATE_ACTIVITY', _count: { id: 25 } },
            ])
            .mockResolvedValueOnce([ // Resource stats
              { resource: 'CLUB', _count: { id: 20 } },
              { resource: 'ACTIVITY', _count: { id: 40 } },
            ]);

          mockPrismaClient.auditLog.findMany.mockResolvedValue([]); // Recent activity

          // Get statistics
          const result = await auditService.getAuditStatistics();
          
          // Verify the statistics structure and calculations
          expect(result).toMatchObject({
            totalEntries: statsData.totalEntries,
            entriesByRole: {
              SUPER_ADMIN: 10,
              CLUB_PRESIDENT: 20,
              STUDENT: 30,
            },
            entriesByAction: {
              CREATE_CLUB: 15,
              UPDATE_ACTIVITY: 25,
            },
            entriesByResource: {
              CLUB: 20,
              ACTIVITY: 40,
            },
            successRate: expect.any(Number),
            recentActivity: expect.any(Array),
          });
          
          // Verify success rate calculation
          const expectedSuccessRate = statsData.totalEntries > 0 
            ? (statsData.successCount / statsData.totalEntries) * 100 
            : 100;
          expect(result.successRate).toBe(expectedSuccessRate);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: State diff calculation should accurately identify changes
   */
  test('should accurately calculate state differences', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          beforeState: fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            value: fc.integer({ min: 0, max: 100 }),
            active: fc.boolean(),
          }),
          afterState: fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            value: fc.integer({ min: 0, max: 100 }),
            active: fc.boolean(),
          }),
        }),
        async ({ beforeState, afterState }) => {
          // Mock database creation
          mockPrismaClient.auditLog.create.mockResolvedValue({
            id: 'test-audit-id',
            timestamp: new Date(),
          });
          
          // Log action with before/after states
          await auditService.logAction({
            userId: 'test-user',
            userRole: UserRole.SUPER_ADMIN,
            action: 'UPDATE_TEST',
            resource: 'TEST',
            beforeState,
            afterState,
          });
          
          // Get the changes object that was passed to create
          const createCall = mockPrismaClient.auditLog.create.mock.calls[0];
          const changes = createCall[0].data.changes;
          
          // Verify changes structure
          expect(changes).toHaveProperty('before', beforeState);
          expect(changes).toHaveProperty('after', afterState);
          
          // Verify diff calculation
          if (JSON.stringify(beforeState) !== JSON.stringify(afterState)) {
            expect(changes).toHaveProperty('diff');
            expect(changes.diff).not.toBeNull();
            
            // Check that diff contains only changed fields
            Object.keys(beforeState).forEach(key => {
              const beforeValue = (beforeState as any)[key];
              const afterValue = (afterState as any)[key];
              if (beforeValue !== afterValue) {
                expect(changes.diff).toHaveProperty(key);
                expect(changes.diff[key]).toEqual({
                  from: beforeValue,
                  to: afterValue,
                });
              }
            });
          }
        }
      ),
      { numRuns: 25 }
    );
  });
});