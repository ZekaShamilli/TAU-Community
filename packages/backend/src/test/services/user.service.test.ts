/**
 * User Service Tests
 */

import { UserService, CreateUserRequest, UpdateUserRequest } from '../../services/user.service';
import { UserRole } from '@prisma/client';

// Mock dependencies
jest.mock('../../lib/database');
jest.mock('bcrypt');

// Mock bcrypt functions
const mockBcrypt = {
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
};

// Replace bcrypt import
jest.doMock('bcrypt', () => mockBcrypt);

// Mock database client
const mockClient = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

// Mock database manager
const mockDb = {
  withContext: jest.fn(),
  getClient: jest.fn().mockReturnValue(mockClient),
};

// Mock DatabaseUtils
const mockDatabaseUtils = {
  logAudit: jest.fn(),
};

// Replace imports
jest.doMock('../../lib/database', () => ({
  db: mockDb,
  DatabaseUtils: mockDatabaseUtils,
}));

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.withContext.mockImplementation(async (userId, role, callback) => {
      return await callback(mockClient);
    });
  });

  describe('createUser', () => {
    const createUserData: CreateUserRequest = {
      email: 'test@example.com',
      password: 'password123',
      role: UserRole.STUDENT,
      firstName: 'Test',
      lastName: 'User',
      phone: '+1234567890',
    };

    const createdBy = 'admin-id';
    const createdByRole = UserRole.SUPER_ADMIN;

    it('should create user successfully', async () => {
      const hashedPassword = 'hashed-password';
      const createdUser = {
        id: 'user-id',
        email: createUserData.email,
        passwordHash: hashedPassword,
        role: createUserData.role,
        firstName: createUserData.firstName,
        lastName: createUserData.lastName,
        phone: createUserData.phone,
        isActive: true,
        totpEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockClient.user.findUnique.mockResolvedValue(null); // No existing user
      mockBcrypt.hash.mockResolvedValue(hashedPassword);
      mockClient.user.create.mockResolvedValue(createdUser);

      const result = await UserService.createUser(createUserData, createdBy, createdByRole);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe(createUserData.email);
      expect(mockClient.user.findUnique).toHaveBeenCalledWith({
        where: { email: createUserData.email },
      });
      expect(mockBcrypt.hash).toHaveBeenCalledWith(createUserData.password, 12);
      expect(mockClient.user.create).toHaveBeenCalledWith({
        data: {
          email: createUserData.email,
          passwordHash: hashedPassword,
          role: createUserData.role,
          firstName: createUserData.firstName,
          lastName: createUserData.lastName,
          phone: createUserData.phone,
        },
      });
      expect(mockDatabaseUtils.logAudit).toHaveBeenCalledWith({
        userId: createdBy,
        userRole: createdByRole,
        action: 'CREATE_USER',
        resource: 'users',
        resourceId: createdUser.id,
        changes: {
          email: createUserData.email,
          role: createUserData.role,
          firstName: createUserData.firstName,
          lastName: createUserData.lastName,
        },
        success: true,
      });
    });

    it('should fail if user already exists', async () => {
      const existingUser = { id: 'existing-id', email: createUserData.email };
      mockClient.user.findUnique.mockResolvedValue(existingUser);

      const result = await UserService.createUser(createUserData, createdBy, createdByRole);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User with this email already exists');
      expect(mockBcrypt.hash).not.toHaveBeenCalled();
      expect(mockClient.user.create).not.toHaveBeenCalled();
    });

    it('should fail with invalid data', async () => {
      const invalidData = {
        ...createUserData,
        email: 'invalid-email',
      };

      const result = await UserService.createUser(invalidData, createdBy, createdByRole);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
      expect(mockClient.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    const userId = 'user-id';
    const requestedBy = 'admin-id';
    const requestedByRole = UserRole.SUPER_ADMIN;

    it('should get user successfully', async () => {
      const user = {
        id: userId,
        email: 'test@example.com',
        role: UserRole.STUDENT,
        firstName: 'Test',
        lastName: 'User',
        phone: '+1234567890',
        isActive: true,
        totpEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockClient.user.findUnique.mockResolvedValue(user);

      const result = await UserService.getUserById(userId, requestedBy, requestedByRole);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.id).toBe(userId);
      expect(mockClient.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('should fail if user not found', async () => {
      mockClient.user.findUnique.mockResolvedValue(null);

      const result = await UserService.getUserById(userId, requestedBy, requestedByRole);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });
  });

  describe('updateUser', () => {
    const userId = 'user-id';
    const updatedBy = 'admin-id';
    const updatedByRole = UserRole.SUPER_ADMIN;
    const updateData: UpdateUserRequest = {
      firstName: 'Updated',
      lastName: 'Name',
    };

    it('should update user successfully', async () => {
      const existingUser = {
        id: userId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      };

      const updatedUser = {
        ...existingUser,
        firstName: updateData.firstName,
        lastName: updateData.lastName,
        updatedAt: new Date(),
      };

      mockClient.user.findUnique.mockResolvedValue(existingUser);
      mockClient.user.update.mockResolvedValue(updatedUser);

      const result = await UserService.updateUser(userId, updateData, updatedBy, updatedByRole);

      expect(result.success).toBe(true);
      expect(result.user?.firstName).toBe(updateData.firstName);
      expect(result.user?.lastName).toBe(updateData.lastName);
      expect(mockClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: updateData,
      });
      expect(mockDatabaseUtils.logAudit).toHaveBeenCalledWith({
        userId: updatedBy,
        userRole: updatedByRole,
        action: 'UPDATE_USER',
        resource: 'users',
        resourceId: userId,
        changes: updateData,
        success: true,
      });
    });

    it('should fail if user not found', async () => {
      mockClient.user.findUnique.mockResolvedValue(null);

      const result = await UserService.updateUser(userId, updateData, updatedBy, updatedByRole);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
      expect(mockClient.user.update).not.toHaveBeenCalled();
    });

    it('should hash password when updating', async () => {
      const existingUser = { id: userId, email: 'test@example.com' };
      const updateDataWithPassword = { ...updateData, password: 'newpassword123' };
      const hashedPassword = 'hashed-new-password';

      mockClient.user.findUnique.mockResolvedValue(existingUser);
      mockBcrypt.hash.mockResolvedValue(hashedPassword);
      mockClient.user.update.mockResolvedValue({ ...existingUser, ...updateData });

      const result = await UserService.updateUser(userId, updateDataWithPassword, updatedBy, updatedByRole);

      expect(result.success).toBe(true);
      expect(mockBcrypt.hash).toHaveBeenCalledWith('newpassword123', 12);
      expect(mockClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          ...updateData,
          passwordHash: hashedPassword,
        },
      });
    });
  });

  describe('deleteUser', () => {
    const userId = 'user-id';
    const deletedBy = 'admin-id';
    const deletedByRole = UserRole.SUPER_ADMIN;

    it('should delete user successfully (soft delete)', async () => {
      const existingUser = { id: userId, email: 'test@example.com', isActive: true };
      mockClient.user.findUnique.mockResolvedValue(existingUser);
      mockClient.user.update.mockResolvedValue({ ...existingUser, isActive: false });

      const result = await UserService.deleteUser(userId, deletedBy, deletedByRole);

      expect(result.success).toBe(true);
      expect(mockClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { isActive: false },
      });
      expect(mockDatabaseUtils.logAudit).toHaveBeenCalledWith({
        userId: deletedBy,
        userRole: deletedByRole,
        action: 'DELETE_USER',
        resource: 'users',
        resourceId: userId,
        success: true,
      });
    });

    it('should fail if user not found', async () => {
      mockClient.user.findUnique.mockResolvedValue(null);

      const result = await UserService.deleteUser(userId, deletedBy, deletedByRole);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
      expect(mockClient.user.update).not.toHaveBeenCalled();
    });
  });

  describe('listUsers', () => {
    const requestedBy = 'admin-id';
    const requestedByRole = UserRole.SUPER_ADMIN;

    it('should list users with pagination', async () => {
      const users = [
        { id: '1', email: 'user1@example.com', firstName: 'User', lastName: 'One' },
        { id: '2', email: 'user2@example.com', firstName: 'User', lastName: 'Two' },
      ];
      const total = 2;

      mockClient.user.findMany.mockResolvedValue(users);
      mockClient.user.count.mockResolvedValue(total);

      const result = await UserService.listUsers(requestedBy, requestedByRole, {
        page: 1,
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(mockClient.user.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter users by role', async () => {
      const users = [{ id: '1', email: 'admin@example.com', role: UserRole.SUPER_ADMIN }];
      mockClient.user.findMany.mockResolvedValue(users);
      mockClient.user.count.mockResolvedValue(1);

      const result = await UserService.listUsers(requestedBy, requestedByRole, {
        role: UserRole.SUPER_ADMIN,
      });

      expect(result.success).toBe(true);
      expect(mockClient.user.findMany).toHaveBeenCalledWith({
        where: { role: UserRole.SUPER_ADMIN },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should search users by name and email', async () => {
      const users = [{ id: '1', email: 'john@example.com', firstName: 'John' }];
      mockClient.user.findMany.mockResolvedValue(users);
      mockClient.user.count.mockResolvedValue(1);

      const result = await UserService.listUsers(requestedBy, requestedByRole, {
        search: 'john',
      });

      expect(result.success).toBe(true);
      expect(mockClient.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { firstName: { contains: 'john', mode: 'insensitive' } },
            { lastName: { contains: 'john', mode: 'insensitive' } },
            { email: { contains: 'john', mode: 'insensitive' } },
          ],
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('changePassword', () => {
    const userId = 'user-id';
    const currentPassword = 'oldpassword123';
    const newPassword = 'newpassword123';
    const changedBy = 'user-id';
    const changedByRole = UserRole.STUDENT;

    it('should change password successfully', async () => {
      const user = {
        id: userId,
        passwordHash: 'old-hashed-password',
      };
      const newHashedPassword = 'new-hashed-password';

      mockClient.user.findUnique.mockResolvedValue(user);
      mockBcrypt.compare.mockResolvedValue(true);
      mockBcrypt.hash.mockResolvedValue(newHashedPassword);
      mockClient.user.update.mockResolvedValue({ ...user, passwordHash: newHashedPassword });

      const result = await UserService.changePassword(
        userId,
        currentPassword,
        newPassword,
        changedBy,
        changedByRole
      );

      expect(result.success).toBe(true);
      expect(mockBcrypt.compare).toHaveBeenCalledWith(currentPassword, user.passwordHash);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(mockClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { passwordHash: newHashedPassword },
      });
    });

    it('should fail with incorrect current password', async () => {
      const user = { id: userId, passwordHash: 'old-hashed-password' };
      mockClient.user.findUnique.mockResolvedValue(user);
      mockBcrypt.compare.mockResolvedValue(false);

      const result = await UserService.changePassword(
        userId,
        currentPassword,
        newPassword,
        changedBy,
        changedByRole
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Current password is incorrect');
      expect(mockClient.user.update).not.toHaveBeenCalled();
    });

    it('should skip current password check for Super Admin changing other user password', async () => {
      const user = { id: userId, passwordHash: 'old-hashed-password' };
      const newHashedPassword = 'new-hashed-password';

      mockClient.user.findUnique.mockResolvedValue(user);
      mockBcrypt.hash.mockResolvedValue(newHashedPassword);
      mockClient.user.update.mockResolvedValue({ ...user, passwordHash: newHashedPassword });

      const result = await UserService.changePassword(
        userId,
        currentPassword,
        newPassword,
        'admin-id',
        UserRole.SUPER_ADMIN
      );

      expect(result.success).toBe(true);
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
      expect(mockBcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
    });
  });

  describe('verifyPassword', () => {
    const email = 'test@example.com';
    const password = 'password123';

    it('should verify password successfully', async () => {
      const user = {
        id: 'user-id',
        email,
        passwordHash: 'hashed-password',
        isActive: true,
        role: UserRole.STUDENT,
        firstName: 'Test',
        lastName: 'User',
      };

      mockClient.user.findUnique.mockResolvedValue(user);
      mockBcrypt.compare.mockResolvedValue(true);

      const result = await UserService.verifyPassword(email, password);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe(email);
      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, user.passwordHash);
    });

    it('should fail with incorrect password', async () => {
      const user = {
        id: 'user-id',
        email,
        passwordHash: 'hashed-password',
        isActive: true,
      };

      mockClient.user.findUnique.mockResolvedValue(user);
      mockBcrypt.compare.mockResolvedValue(false);

      const result = await UserService.verifyPassword(email, password);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should fail if user not found', async () => {
      mockClient.user.findUnique.mockResolvedValue(null);

      const result = await UserService.verifyPassword(email, password);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should fail if user is inactive', async () => {
      const user = {
        id: 'user-id',
        email,
        passwordHash: 'hashed-password',
        isActive: false,
      };

      mockClient.user.findUnique.mockResolvedValue(user);

      const result = await UserService.verifyPassword(email, password);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });
  });

  describe('getUsersByRole', () => {
    const requestedBy = 'admin-id';
    const requestedByRole = UserRole.SUPER_ADMIN;

    it('should get users by role successfully', async () => {
      const users = [
        { id: '1', email: 'admin1@example.com', role: UserRole.SUPER_ADMIN },
        { id: '2', email: 'admin2@example.com', role: UserRole.SUPER_ADMIN },
      ];

      mockClient.user.findMany.mockResolvedValue(users);

      const result = await UserService.getUsersByRole(
        UserRole.SUPER_ADMIN,
        requestedBy,
        requestedByRole
      );

      expect(result.success).toBe(true);
      expect(result.users).toHaveLength(2);
      expect(mockClient.user.findMany).toHaveBeenCalledWith({
        where: {
          role: UserRole.SUPER_ADMIN,
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});