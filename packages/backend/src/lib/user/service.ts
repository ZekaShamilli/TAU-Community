/**
 * User Service
 * Provides CRUD operations for user management with role-based access control
 */

import bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { db, DatabaseUtils } from '../database';
import { 
  CreateUserRequest, 
  UpdateUserRequest, 
  UserResponse, 
  UserFilters,
  UserServiceResult,
  PasswordChangeRequest
} from './types';

export class UserService {
  private static readonly SALT_ROUNDS = 12;

  /**
   * Create a new user
   */
  public static async createUser(
    request: CreateUserRequest,
    createdBy: string,
    createdByRole: UserRole
  ): Promise<UserServiceResult<UserResponse>> {
    try {
      const { email, password, role, firstName, lastName, phone, clubId } = request;

      // Validate permissions
      if (createdByRole !== UserRole.SUPER_ADMIN) {
        return {
          success: false,
          error: 'Only Super Admins can create users',
        };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

      // Use database transaction for atomic operations
      const client = db.getClient();
      
      const result = await client.$transaction(async (tx) => {
        // Check if email already exists
        const existingUser = await tx.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (existingUser) {
          throw new Error('User with this email already exists');
        }

        // If creating a Club President, validate club exists and has no president
        if (role === UserRole.CLUB_PRESIDENT && clubId) {
          const club = await tx.club.findUnique({
            where: { id: clubId },
            include: { president: true },
          });

          if (!club) {
            throw new Error('Club not found');
          }

          if (club.president) {
            throw new Error('Club already has a president');
          }
        }

        // Create user
        const newUser = await tx.user.create({
          data: {
            email: email.toLowerCase(),
            passwordHash,
            role,
            firstName,
            lastName,
            phone,
            isActive: true,
            totpEnabled: false,
          },
          select: {
            id: true,
            email: true,
            role: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
            totpEnabled: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        // If creating a Club President, assign them to the club
        if (role === UserRole.CLUB_PRESIDENT && clubId) {
          await tx.club.update({
            where: { id: clubId },
            data: { presidentId: newUser.id },
          });
        }

        // Log user creation
        await DatabaseUtils.logAudit({
          userId: createdBy,
          userRole: createdByRole,
          action: 'USER_CREATE',
          resource: 'USER',
          resourceId: newUser.id,
          changes: {
            email: newUser.email,
            role: newUser.role,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            clubId,
          },
          success: true,
        });

        return {
          ...newUser,
          phone: newUser.phone || undefined,
          clubId: role === UserRole.CLUB_PRESIDENT ? clubId : undefined,
        };
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Create user error:', error);
      
      // Log failed creation attempt
      await DatabaseUtils.logAudit({
        userId: createdBy,
        userRole: createdByRole,
        action: 'USER_CREATE',
        resource: 'USER',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create user',
      };
    }
  }

  /**
   * Get user by ID
   */
  public static async getUserById(
    userId: string,
    requestedBy: string,
    requestedByRole: UserRole,
    requestedByClubId?: string
  ): Promise<UserServiceResult<UserResponse>> {
    try {
      // Check permissions
      if (!this.canAccessUser(userId, requestedBy, requestedByRole, requestedByClubId)) {
        return {
          success: false,
          error: 'Insufficient permissions to access user',
        };
      }

      const client = db.getClient();
      const user = await client.user.findUnique({
        where: { id: userId },
        include: {
          presidedClub: {
            select: { id: true, name: true },
          },
        },
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      const userResponse: UserResponse = {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || undefined,
        isActive: user.isActive,
        totpEnabled: user.totpEnabled,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        clubId: user.presidedClub && user.presidedClub.length > 0 ? user.presidedClub[0].id : undefined,
        clubName: user.presidedClub && user.presidedClub.length > 0 ? user.presidedClub[0].name : undefined,
      };

      return {
        success: true,
        data: userResponse,
      };
    } catch (error) {
      console.error('Get user error:', error);
      return {
        success: false,
        error: 'Failed to retrieve user',
      };
    }
  }

  /**
   * Update user information
   */
  public static async updateUser(
    userId: string,
    request: UpdateUserRequest,
    updatedBy: string,
    updatedByRole: UserRole,
    updatedByClubId?: string
  ): Promise<UserServiceResult<UserResponse>> {
    try {
      // Check permissions
      if (!this.canModifyUser(userId, updatedBy, updatedByRole, updatedByClubId)) {
        return {
          success: false,
          error: 'Insufficient permissions to update user',
        };
      }

      const client = db.getClient();
      
      const result = await client.$transaction(async (tx) => {
        // Get current user data
        const currentUser = await tx.user.findUnique({
          where: { id: userId },
          include: {
            presidedClub: {
              select: { id: true, name: true },
            },
          },
        });

        if (!currentUser) {
          throw new Error('User not found');
        }

        // Prepare update data
        const updateData: any = {};
        const changes: any = {};

        if (request.firstName !== undefined && request.firstName !== currentUser.firstName) {
          updateData.firstName = request.firstName;
          changes.firstName = { from: currentUser.firstName, to: request.firstName };
        }

        if (request.lastName !== undefined && request.lastName !== currentUser.lastName) {
          updateData.lastName = request.lastName;
          changes.lastName = { from: currentUser.lastName, to: request.lastName };
        }

        if (request.phone !== undefined && request.phone !== currentUser.phone) {
          updateData.phone = request.phone;
          changes.phone = { from: currentUser.phone, to: request.phone };
        }

        if (request.isActive !== undefined && request.isActive !== currentUser.isActive) {
          // Only Super Admins can change active status
          if (updatedByRole !== UserRole.SUPER_ADMIN) {
            throw new Error('Only Super Admins can change user active status');
          }
          updateData.isActive = request.isActive;
          changes.isActive = { from: currentUser.isActive, to: request.isActive };
        }

        // Handle role changes (Super Admin only)
        if (request.role !== undefined && request.role !== currentUser.role) {
          if (updatedByRole !== UserRole.SUPER_ADMIN) {
            throw new Error('Only Super Admins can change user roles');
          }

          // If changing from Club President, remove club association
          if (currentUser.role === UserRole.CLUB_PRESIDENT && currentUser.presidedClub.length > 0) {
            await tx.club.update({
              where: { id: currentUser.presidedClub[0].id },
              data: { presidentId: null },
            });
          }

          updateData.role = request.role;
          changes.role = { from: currentUser.role, to: request.role };

          // If changing to Club President and clubId provided, assign to club
          if (request.role === UserRole.CLUB_PRESIDENT && request.clubId) {
            const club = await tx.club.findUnique({
              where: { id: request.clubId },
              include: { president: true },
            });

            if (!club) {
              throw new Error('Club not found');
            }

            if (club.president && club.president.id !== userId) {
              throw new Error('Club already has a president');
            }

            await tx.club.update({
              where: { id: request.clubId },
              data: { presidentId: userId },
            });

            changes.clubId = { from: currentUser.presidedClub[0]?.id, to: request.clubId };
          }
        }

        // Only update if there are changes
        if (Object.keys(updateData).length === 0) {
          return currentUser;
        }

        updateData.updatedAt = new Date();

        // Update user
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: updateData,
          include: {
            presidedClub: {
              select: { id: true, name: true },
            },
          },
        });

        // Log user update
        await DatabaseUtils.logAudit({
          userId: updatedBy,
          userRole: updatedByRole,
          action: 'USER_UPDATE',
          resource: 'USER',
          resourceId: userId,
          changes,
          success: true,
        });

        return updatedUser;
      });

      const userResponse: UserResponse = {
        id: result.id,
        email: result.email,
        role: result.role,
        firstName: result.firstName,
        lastName: result.lastName,
        phone: result.phone || undefined,
        isActive: result.isActive,
        totpEnabled: result.totpEnabled,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        clubId: result.presidedClub && result.presidedClub.length > 0 ? result.presidedClub[0].id : undefined,
        clubName: result.presidedClub && result.presidedClub.length > 0 ? result.presidedClub[0].name : undefined,
      };

      return {
        success: true,
        data: userResponse,
      };
    } catch (error) {
      console.error('Update user error:', error);
      
      // Log failed update attempt
      await DatabaseUtils.logAudit({
        userId: updatedBy,
        userRole: updatedByRole,
        action: 'USER_UPDATE',
        resource: 'USER',
        resourceId: userId,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update user',
      };
    }
  }

  /**
   * Delete user (soft delete by setting isActive to false)
   */
  public static async deleteUser(
    userId: string,
    deletedBy: string,
    deletedByRole: UserRole
  ): Promise<UserServiceResult<void>> {
    try {
      // Only Super Admins can delete users
      if (deletedByRole !== UserRole.SUPER_ADMIN) {
        return {
          success: false,
          error: 'Only Super Admins can delete users',
        };
      }

      const client = db.getClient();
      
      await client.$transaction(async (tx) => {
        // Get current user data
        const currentUser = await tx.user.findUnique({
          where: { id: userId },
          include: {
            presidedClub: {
              select: { id: true },
            },
          },
        });

        if (!currentUser) {
          throw new Error('User not found');
        }

        if (!currentUser.isActive) {
          throw new Error('User is already inactive');
        }

        // If user is a Club President, remove club association
        if (currentUser.role === UserRole.CLUB_PRESIDENT && currentUser.presidedClub.length > 0) {
          await tx.club.update({
            where: { id: currentUser.presidedClub[0].id },
            data: { presidentId: null },
          });
        }

        // Soft delete user
        await tx.user.update({
          where: { id: userId },
          data: {
            isActive: false,
            updatedAt: new Date(),
          },
        });

        // Log user deletion
        await DatabaseUtils.logAudit({
          userId: deletedBy,
          userRole: deletedByRole,
          action: 'USER_DELETE',
          resource: 'USER',
          resourceId: userId,
          changes: {
            isActive: { from: true, to: false },
            clubId: currentUser.presidedClub[0]?.id,
          },
          success: true,
        });
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error('Delete user error:', error);
      
      // Log failed deletion attempt
      await DatabaseUtils.logAudit({
        userId: deletedBy,
        userRole: deletedByRole,
        action: 'USER_DELETE',
        resource: 'USER',
        resourceId: userId,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete user',
      };
    }
  }

  /**
   * List users with filtering
   */
  public static async listUsers(
    filters: UserFilters,
    requestedBy: string,
    requestedByRole: UserRole,
    requestedByClubId?: string
  ): Promise<UserServiceResult<UserResponse[]>> {
    try {
      // Check permissions
      if (requestedByRole === UserRole.STUDENT) {
        return {
          success: false,
          error: 'Students cannot list users',
        };
      }

      const client = db.getClient();
      
      // Build where clause based on filters and permissions
      const where: any = {};

      // Role-based filtering
      if (requestedByRole === UserRole.CLUB_PRESIDENT) {
        // Club Presidents can only see users in their club or students who applied
        where.OR = [
          { id: requestedBy }, // Own profile
          { 
            role: UserRole.STUDENT,
            applications: {
              some: {
                clubId: requestedByClubId,
              },
            },
          },
        ];
      }

      // Apply filters
      if (filters.role) {
        if (requestedByRole === UserRole.CLUB_PRESIDENT && filters.role !== UserRole.STUDENT) {
          return {
            success: false,
            error: 'Club Presidents can only filter by Student role',
          };
        }
        where.role = filters.role;
      }

      if (filters.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      if (filters.email) {
        where.email = {
          contains: filters.email,
          mode: 'insensitive',
        };
      }

      if (filters.name) {
        where.OR = [
          {
            firstName: {
              contains: filters.name,
              mode: 'insensitive',
            },
          },
          {
            lastName: {
              contains: filters.name,
              mode: 'insensitive',
            },
          },
        ];
      }

      if (filters.clubId && requestedByRole === UserRole.SUPER_ADMIN) {
        where.presidedClub = {
          some: {
            id: filters.clubId,
          },
        };
      }

      const users = await client.user.findMany({
        where,
        include: {
          presidedClub: {
            select: { id: true, name: true },
          },
        },
        orderBy: [
          { lastName: 'asc' },
          { firstName: 'asc' },
        ],
        take: filters.limit || 50,
        skip: filters.offset || 0,
      });

      const userResponses: UserResponse[] = users.map(user => ({
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || undefined,
        isActive: user.isActive,
        totpEnabled: user.totpEnabled,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        clubId: user.presidedClub && user.presidedClub.length > 0 ? user.presidedClub[0].id : undefined,
        clubName: user.presidedClub && user.presidedClub.length > 0 ? user.presidedClub[0].name : undefined,
      }));

      return {
        success: true,
        data: userResponses,
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
  public static async changePassword(
    userId: string,
    request: PasswordChangeRequest,
    changedBy: string,
    changedByRole: UserRole
  ): Promise<UserServiceResult<void>> {
    try {
      // Check permissions
      if (changedBy !== userId && changedByRole !== UserRole.SUPER_ADMIN) {
        return {
          success: false,
          error: 'You can only change your own password unless you are a Super Admin',
        };
      }

      const client = db.getClient();
      
      await client.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          throw new Error('User not found');
        }

        // If changing own password, verify current password
        if (changedBy === userId && request.currentPassword) {
          const currentPasswordValid = await bcrypt.compare(request.currentPassword, user.passwordHash);
          if (!currentPasswordValid) {
            throw new Error('Current password is incorrect');
          }
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(request.newPassword, this.SALT_ROUNDS);

        // Update password
        await tx.user.update({
          where: { id: userId },
          data: {
            passwordHash: newPasswordHash,
            updatedAt: new Date(),
          },
        });

        // Log password change
        await DatabaseUtils.logAudit({
          userId: changedBy,
          userRole: changedByRole,
          action: 'PASSWORD_CHANGE',
          resource: 'USER',
          resourceId: userId,
          success: true,
        });
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error('Change password error:', error);
      
      // Log failed password change attempt
      await DatabaseUtils.logAudit({
        userId: changedBy,
        userRole: changedByRole,
        action: 'PASSWORD_CHANGE',
        resource: 'USER',
        resourceId: userId,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to change password',
      };
    }
  }

  /**
   * Validate password strength
   */
  public static validatePassword(password: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must be no more than 128 characters long');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[^a-zA-Z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Hash password with bcrypt
   */
  public static async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Verify password against hash
   */
  public static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Check if user can access another user's information
   */
  private static canAccessUser(
    targetUserId: string,
    requestedBy: string,
    requestedByRole: UserRole,
    requestedByClubId?: string
  ): boolean {
    // Super Admins can access any user
    if (requestedByRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Users can access their own information
    if (targetUserId === requestedBy) {
      return true;
    }

    // Club Presidents can access students who applied to their club
    // This would require additional database query, so we'll allow it here
    // and handle the filtering in the actual query
    if (requestedByRole === UserRole.CLUB_PRESIDENT) {
      return true; // Will be filtered in the query
    }

    // Students cannot access other users
    return false;
  }

  /**
   * Check if user can modify another user's information
   */
  private static canModifyUser(
    targetUserId: string,
    modifiedBy: string,
    modifiedByRole: UserRole,
    modifiedByClubId?: string
  ): boolean {
    // Super Admins can modify any user
    if (modifiedByRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Users can modify their own information (limited fields)
    if (targetUserId === modifiedBy) {
      return true;
    }

    // Club Presidents and Students cannot modify other users
    return false;
  }
}