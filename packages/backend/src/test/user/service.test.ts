/**
 * User Service Unit Tests
 */

import { UserService } from '../../lib/user';
import { UserRole } from '@prisma/client';
import { db } from '../../lib/database';
import bcrypt from 'bcrypt';

// Mock the database
jest.mock('../../lib/database');

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockDb = db as jest.Mocked<typeof db>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('UserService', () => {
  let mockClient: any;
  let mockTransaction: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup bcrypt mocks
    (mockBcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);
    
    // Setup mock transaction
    mockTransaction = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      club: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    // Setup mock client
    mockClient = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      club: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((callback) => callback(mockTransaction)),
    };

    mockDb.getClient.mockReturnValue(mockClient);
  });

  describe('createUser', () => {
    const createUserRequest = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      role: UserRole.STUDENT,
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
    };

    it('should create a new user successfully', async () => {
      const createdUser = {
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

      mockTransaction.user.findUnique.mockResolvedValue(null); // No existing user
      mockTransaction.user.create.mockResolvedValue(createdUser);

      const result = await UserService.createUser(
        createUserRequest,
        'admin-id',
        UserRole.SUPER_ADMIN
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        id: 'user-id',
        email: 'test@example.com',
        role: UserRole.STUDENT,
      }));
      expect(mockBcrypt.hash).toHaveBeenCalledWith('TestPassword123!', 12);
    });

    it('should fail if non-super-admin tries to create user', async () => {
      const result = await UserService.createUser(
        createUserRequest,
        'club-president-id',
        UserRole.CLUB_PRESIDENT
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Only Super Admins can create users');
    });

    it('should fail if email already exists', async () => {
      mockTransaction.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      const result = await UserService.createUser(
        createUserRequest,
        'admin-id',
        UserRole.SUPER_ADMIN
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('User with this email already exists');
    });
  });

  describe('getUserById', () => {
    const mockUser = {
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
      presidedClub: [],
    };

    it('should return user for super admin', async () => {
      mockClient.user.findUnique.mockResolvedValue(mockUser);

      const result = await UserService.getUserById(
        'user-id',
        'admin-id',
        UserRole.SUPER_ADMIN
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        id: 'user-id',
        email: 'test@example.com',
      }));
    });

    it('should return own user information', async () => {
      mockClient.user.findUnique.mockResolvedValue(mockUser);

      const result = await UserService.getUserById(
        'user-id',
        'user-id',
        UserRole.STUDENT
      );

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('user-id');
    });

    it('should fail if user not found', async () => {
      mockClient.user.findUnique.mockResolvedValue(null);

      const result = await UserService.getUserById(
        'user-id',
        'admin-id',
        UserRole.SUPER_ADMIN
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });
  });

  describe('validatePassword', () => {
    it('should validate strong password', () => {
      const result = UserService.validatePassword('StrongPass123!');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password that is too short', () => {
      const result = UserService.validatePassword('Short1!');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without lowercase', () => {
      const result = UserService.validatePassword('PASSWORD123!');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without uppercase', () => {
      const result = UserService.validatePassword('password123!');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without numbers', () => {
      const result = UserService.validatePassword('Password!');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special characters', () => {
      const result = UserService.validatePassword('Password123');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should reject password that is too long', () => {
      const longPassword = 'A'.repeat(129) + '1!';
      const result = UserService.validatePassword(longPassword);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be no more than 128 characters long');
    });
  });

  describe('hashPassword', () => {
    it('should hash password with bcrypt', async () => {
      (mockBcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');

      const result = await UserService.hashPassword('password123');

      expect(result).toBe('hashed_password');
      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 12);
    });
  });

  describe('verifyPassword', () => {
    it('should verify password against hash', async () => {
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await UserService.verifyPassword('password123', 'hashed_password');

      expect(result).toBe(true);
      expect(mockBcrypt.compare).toHaveBeenCalledWith('password123', 'hashed_password');
    });

    it('should return false for incorrect password', async () => {
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await UserService.verifyPassword('wrongpassword', 'hashed_password');

      expect(result).toBe(false);
    });
  });
});