/**
 * User Service - CRUD operations for user management
 */

import bcrypt from 'bcrypt';
import { z } from 'zod';
import { PrismaClient, UserRole } from '@prisma/client';
import { db, DatabaseUtils } from '../lib/database';

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.nativeEnum(UserRole),
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(100),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').max(100),
  phone: z.string().optional(),
});

const updateUserSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(100).optional(),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').max(100).optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
});

export interface CreateUserRequest {
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface UpdateUserRequest {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  isActive?: boolean;
}

export interface UserResponse {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
  isActive: boolean;
  totpEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class UserService {
  /**
   * Create a new user
   */
  static async createUser(
    data: CreateUserRequest,
    createdBy: string,
    createdByRole: UserRole
  ): Promise<{ success: boolean; user?: UserResponse; error?: string }> {
    try {
      // Validate input
      const validation = createUserSchema.safeParse(data);
      if (!validation.success) {
        return {
          success: false,
          error: `Validation error: ${validation.error.errors.map(e => e.message).join(', ')}`,
        };
      }

      // Check if user already exists
      const existingUser = await db.withContext(createdBy, createdByRole, async (client) => {
        return await client.user.findUnique({
          where: { email: data.email },
        });
      });

      if (existingUser) {
        return {
          success: false,
          error: 'User with this email already exists',
        };
      }

      // Hash password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
      const passwordHash = await bcrypt.hash(data.password, saltRounds);

      // Create user
      const user = await db.withContext(createdBy, createdByRole, async (client) => {
        return await client.user.create({
          data: {
            email: data.email,
            passwordHash,
            role: data.role,
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
          },
        });
      });

      // Log user creation
      await DatabaseUtils.logAudit({
        userId: createdBy,
        userRole: createdByRole,
        action: 'CREATE_USER',
        resource: 'users',
        resourceId: user.id,
        changes: {
          email: data.email,
          role: data.role,
          firstName: data.firstName,
          lastName: data.lastName,
        },
        success: true,
      });

      return {
        success: true,
        user: this.formatUserResponse(user),
      };
    } catch (error) {
      console.error('Create user error:', error);
      return {
        success: false,
        error: 'Failed to create user',
      };
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(
    userId: string,
    requestedBy: string,
    requestedByRole: UserRole
  ): Promise<{ success: boolean; user?: UserResponse; error?: string }> {
    try {
      const user = await db.withContext(requestedBy, requestedByRole, async (client) => {
        return await client.user.findUnique({
          where: { id: userId },
        });
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      return {
        success: true,
        user: this.formatUserResponse(user),
      };
    } catch (error) {
      console.error('Get user error:', error);
      return {
        success: false,
        error: 'Failed to get user',
      };
    }
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(
    email: string,
    requestedBy: string,
    requestedByRole: UserRole
  ): Promise<{ success: boolean; user?: UserResponse; error?: string }> {
    try {
      const user = await db.withContext(requestedBy, requestedByRole, async (client) => {
        return await client.user.findUnique({
          where: { email },
        });
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      return {
        success: true,
        user: this.formatUserResponse(user),
      };
    } catch (error) {
      console.error('Get user by email error:', error);
      return {
        success: false,
        error: 'Failed to get user',
      };
    }
  }

  /**
   * Update user
   */
  static async updateUser(
    userId: string,
    data: UpdateUserRequest,
    updatedBy: string,
    updatedByRole: UserRole
  ): Promise<{ success: boolean; user?: UserResponse; error?: string }> {
    try {
      // Validate input
      const validation = updateUserSchema.safeParse(data);
      if (!validation.success) {
        return {
          success: false,
          error: `Validation error: ${validation.error.errors.map(e => e.message).join(', ')}`,
        };
      }

      // Check if user exists
      const existingUser = await db.withContext(updatedBy, updatedByRole, async (client) => {
        return await client.user.findUnique({
          where: { id: userId },
        });
      });

      if (!existingUser) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Check if email is being changed and if it's already taken
      if (data.email && data.email !== existingUser.email) {
        const emailExists = await db.withContext(updatedBy, updatedByRole, async (client) => {
          return await client.user.findUnique({
            where: { email: data.email },
          });
        });

        if (emailExists) {
          return {
            success: false,
            error: 'Email already in use',
          };
        }
      }

      // Prepare update data
      const updateData: any = {
        ...data,
      };

      // Hash password if provided
      if (data.password) {
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
        updateData.passwordHash = await bcrypt.hash(data.password, saltRounds);
        delete updateData.password;
      }

      // Update user
      const user = await db.withContext(updatedBy, updatedByRole, async (client) => {
        return await client.user.update({
          where: { id: userId },
          data: updateData,
        });
      });

      // Log user update
      await DatabaseUtils.logAudit({
        userId: updatedBy,
        userRole: updatedByRole,
        action: 'UPDATE_USER',
        resource: 'users',
        resourceId: userId,
        changes: data,
        success: true,
      });

      return {
        success: true,
        user: this.formatUserResponse(user),
      };
    } catch (error) {
      console.error('Update user error:', error);
      return {
        success: false,
        error: 'Failed to update user',
      };
    }
  }

  /**
   * Delete user (soft delete by setting isActive to false)
   */
  static async deleteUser(
    userId: string,
    deletedBy: string,
    deletedByRole: UserRole
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if user exists
      const existingUser = await db.withContext(deletedBy, deletedByRole, async (client) => {
        return await client.user.findUnique({
          where: { id: userId },
        });
      });

      if (!existingUser) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Soft delete user
      await db.withContext(deletedBy, deletedByRole, async (client) => {
        return await client.user.update({
          where: { id: userId },
          data: { isActive: false },
        });
      });

      // Log user deletion
      await DatabaseUtils.logAudit({
        userId: deletedBy,
        userRole: deletedByRole,
        action: 'DELETE_USER',
        resource: 'users',
        resourceId: userId,
        success: true,
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error('Delete user error:', error);
      return {
        success: false,
        error: 'Failed to delete user',
      };
    }
  }

  /**
   * List users with pagination and filtering
   */
  static async listUsers(
    requestedBy: string,
    requestedByRole: UserRole,
    options: {
      page?: number;
      limit?: number;
      role?: UserRole;
      isActive?: boolean;
      search?: string;
    } = {}
  ): Promise<{
    success: boolean;
    users?: UserResponse[];
    total?: number;
    page?: number;
    limit?: number;
    error?: string;
  }> {
    try {
      const page = options.page || 1;
      const limit = Math.min(options.limit || 10, 100); // Max 100 per page
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};
      
      if (options.role) {
        where.role = options.role;
      }
      
      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }
      
      if (options.search) {
        where.OR = [
          { firstName: { contains: options.search, mode: 'insensitive' } },
          { lastName: { contains: options.search, mode: 'insensitive' } },
          { email: { contains: options.search, mode: 'insensitive' } },
        ];
      }

      const [users, total] = await db.withContext(requestedBy, requestedByRole, async (client) => {
        return await Promise.all([
          client.user.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
          }),
          client.user.count({ where }),
        ]);
      });

      return {
        success: true,
        users: users.map(user => this.formatUserResponse(user)),
        total,
        page,
        limit,
      };
    } catch (error) {
      console.error('List users error:', error);
      return {
        success: false,
        error: 'Failed to list users',
      };
    }
  }

  /**
   * Change user password
   */
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    changedBy: string,
    changedByRole: UserRole
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate new password
      if (newPassword.length < 8) {
        return {
          success: false,
          error: 'New password must be at least 8 characters',
        };
      }

      // Get user with password hash
      const user = await db.withContext(changedBy, changedByRole, async (client) => {
        return await client.user.findUnique({
          where: { id: userId },
        });
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Verify current password (unless changed by Super Admin)
      if (changedByRole !== UserRole.SUPER_ADMIN || changedBy === userId) {
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isCurrentPasswordValid) {
          return {
            success: false,
            error: 'Current password is incorrect',
          };
        }
      }

      // Hash new password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await db.withContext(changedBy, changedByRole, async (client) => {
        return await client.user.update({
          where: { id: userId },
          data: { passwordHash: newPasswordHash },
        });
      });

      // Log password change
      await DatabaseUtils.logAudit({
        userId: changedBy,
        userRole: changedByRole,
        action: 'CHANGE_PASSWORD',
        resource: 'users',
        resourceId: userId,
        success: true,
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error('Change password error:', error);
      return {
        success: false,
        error: 'Failed to change password',
      };
    }
  }

  /**
   * Verify user password
   */
  static async verifyPassword(
    email: string,
    password: string
  ): Promise<{ success: boolean; user?: UserResponse; error?: string }> {
    try {
      // Get user by email (using default client for login)
      const user = await db.getClient().user.findUnique({
        where: { email },
      });

      if (!user || !user.isActive) {
        return {
          success: false,
          error: 'Invalid credentials',
        };
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return {
          success: false,
          error: 'Invalid credentials',
        };
      }

      return {
        success: true,
        user: this.formatUserResponse(user),
      };
    } catch (error) {
      console.error('Verify password error:', error);
      return {
        success: false,
        error: 'Authentication failed',
      };
    }
  }

  /**
   * Get users by role
   */
  static async getUsersByRole(
    role: UserRole,
    requestedBy: string,
    requestedByRole: UserRole
  ): Promise<{ success: boolean; users?: UserResponse[]; error?: string }> {
    try {
      const users = await db.withContext(requestedBy, requestedByRole, async (client) => {
        return await client.user.findMany({
          where: {
            role,
            isActive: true,
          },
          orderBy: { createdAt: 'desc' },
        });
      });

      return {
        success: true,
        users: users.map(user => this.formatUserResponse(user)),
      };
    } catch (error) {
      console.error('Get users by role error:', error);
      return {
        success: false,
        error: 'Failed to get users by role',
      };
    }
  }

  /**
   * Format user response (remove sensitive data)
   */
  private static formatUserResponse(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      isActive: user.isActive,
      totpEnabled: user.totpEnabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}