/**
 * User Routes Integration Tests
 */

import request from 'supertest';
import { UserRole } from '@prisma/client';
import { app } from '../../app';
import { AuthService } from '../../lib/auth';
import { UserService } from '../../lib/user';

// Mock the services
jest.mock('../../lib/auth');
jest.mock('../../lib/user');

const mockAuthService = AuthService as jest.Mocked<typeof AuthService>;
const mockUserService = UserService as jest.Mocked<typeof UserService>;

describe('User Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock authentication middleware
    mockAuthService.validateToken.mockResolvedValue({
      valid: true,
      payload: {
        userId: 'admin-id',
        role: UserRole.SUPER_ADMIN,
        permissions: ['user:create', 'user:read', 'user:update', 'user:delete'],
        iat: Date.now(),
        exp: Date.now() + 3600000,
      },
    });

    mockAuthService.hasPermission.mockReturnValue(true);
  });

  describe('POST /api/users', () => {
    it('should create a new user', async () => {
      const newUser = {
        id: 'user-id',
        email: 'test@example.com',
        role: UserRole.STUDENT,
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        isActive: true,
        totpEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserService.createUser.mockResolvedValue({
        success: true,
        data: newUser,
      });

      mockUserService.validatePassword.mockReturnValue({
        valid: true,
        errors: [],
      });

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer valid-token')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
          role: UserRole.STUDENT,
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toEqual(newUser);
    });

    it('should reject weak passwords', async () => {
      mockUserService.validatePassword.mockReturnValue({
        valid: false,
        errors: ['Password must be at least 8 characters long'],
      });

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer valid-token')
        .send({
          email: 'test@example.com',
          password: 'weak',
          role: UserRole.STUDENT,
          firstName: 'John',
          lastName: 'Doe',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('WEAK_PASSWORD');
    });

    it('should require club ID for Club President role', async () => {
      mockUserService.validatePassword.mockReturnValue({
        valid: true,
        errors: [],
      });

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer valid-token')
        .send({
          email: 'president@example.com',
          password: 'TestPassword123!',
          role: UserRole.CLUB_PRESIDENT,
          firstName: 'Jane',
          lastName: 'Smith',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_CLUB_ID');
    });

    it('should validate request data', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer valid-token')
        .send({
          email: 'invalid-email',
          password: 'short',
          role: 'INVALID_ROLE',
          firstName: 'A',
          lastName: 'B',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return user by ID', async () => {
      const user = {
        id: 'user-id',
        email: 'test@example.com',
        role: UserRole.STUDENT,
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        isActive: true,
        totpEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserService.getUserById.mockResolvedValue({
        success: true,
        data: user,
      });

      const response = await request(app)
        .get('/api/users/user-id')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toEqual(user);
    });

    it('should return 404 for non-existent user', async () => {
      mockUserService.getUserById.mockResolvedValue({
        success: false,
        error: 'User not found',
      });

      const response = await request(app)
        .get('/api/users/non-existent-id')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should return 403 for insufficient permissions', async () => {
      mockUserService.getUserById.mockResolvedValue({
        success: false,
        error: 'Insufficient permissions to access user',
      });

      const response = await request(app)
        .get('/api/users/user-id')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('ACCESS_DENIED');
    });
  });

  describe('GET /api/users', () => {
    it('should list users', async () => {
      const users = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          role: UserRole.STUDENT,
          firstName: 'John',
          lastName: 'Doe',
          isActive: true,
          totpEnabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          role: UserRole.CLUB_PRESIDENT,
          firstName: 'Jane',
          lastName: 'Smith',
          isActive: true,
          totpEnabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          clubId: 'club-id',
          clubName: 'Test Club',
        },
      ];

      mockUserService.listUsers.mockResolvedValue({
        success: true,
        data: users,
      });

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toEqual(users);
      expect(response.body.data.count).toBe(2);
    });

    it('should handle query parameters', async () => {
      mockUserService.listUsers.mockResolvedValue({
        success: true,
        data: [],
      });

      const response = await request(app)
        .get('/api/users')
        .query({
          role: UserRole.STUDENT,
          isActive: 'true',
          limit: '10',
          offset: '0',
        })
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(mockUserService.listUsers).toHaveBeenCalledWith(
        {
          role: UserRole.STUDENT,
          isActive: true,
          limit: 10,
          offset: 0,
        },
        'admin-id',
        UserRole.SUPER_ADMIN,
        undefined
      );
    });
  });

  describe('POST /api/users/validate-password', () => {
    it('should validate password strength', async () => {
      mockUserService.validatePassword.mockReturnValue({
        valid: true,
        errors: [],
      });

      const response = await request(app)
        .post('/api/users/validate-password')
        .send({
          password: 'StrongPassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.errors).toEqual([]);
    });

    it('should return validation errors for weak password', async () => {
      mockUserService.validatePassword.mockReturnValue({
        valid: false,
        errors: ['Password must be at least 8 characters long'],
      });

      const response = await request(app)
        .post('/api/users/validate-password')
        .send({
          password: 'weak',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.errors).toContain('Password must be at least 8 characters long');
    });

    it('should require password parameter', async () => {
      const response = await request(app)
        .post('/api/users/validate-password')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_PASSWORD');
    });
  });
});