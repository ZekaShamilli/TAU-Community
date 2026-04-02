/**
 * User management routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { UserService, CreateUserRequest, UpdateUserRequest } from '../services/user.service';
import { 
  authenticate, 
  requireSuperAdmin, 
  requireAuth,
  auditLog 
} from '../lib/middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

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

const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const validatePasswordSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

const listUsersSchema = z.object({
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

/**
 * POST /users
 * Create a new user (Super Admin only)
 */
router.post('/',
  authenticate,
  requireSuperAdmin,
  auditLog('CREATE_USER', 'users'),
  async (req: Request, res: Response) => {
    try {
      const validation = createUserSchema.safeParse(req.body);
      
      if (!validation.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: validation.error.errors,
          },
        });
        return;
      }

      const result = await UserService.createUser(
        validation.data,
        req.userId!,
        req.userRole!
      );

      if (!result.success) {
        res.status(400).json({
          error: {
            code: 'CREATE_USER_FAILED',
            message: result.error,
          },
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: {
          user: result.user,
        },
      });
    } catch (error) {
      console.error('Create user route error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create user',
        },
      });
    }
  }
);

/**
 * GET /users
 * List users with pagination and filtering
 */
router.get('/',
  authenticate,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const validation = listUsersSchema.safeParse(req.query);
      
      if (!validation.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: validation.error.errors,
          },
        });
        return;
      }

      const result = await UserService.listUsers(
        req.userId!,
        req.userRole!,
        validation.data
      );

      if (!result.success) {
        res.status(500).json({
          error: {
            code: 'LIST_USERS_FAILED',
            message: result.error,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          users: result.users,
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: Math.ceil((result.total || 0) / (result.limit || 10)),
          },
        },
      });
    } catch (error) {
      console.error('List users route error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list users',
        },
      });
    }
  }
);

/**
 * GET /users/:id
 * Get user by ID
 */
router.get('/:id',
  authenticate,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;

      // Users can only view their own profile unless they're Super Admin
      if (req.userRole !== UserRole.SUPER_ADMIN && req.userId !== userId) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied to this user profile',
          },
        });
        return;
      }

      const result = await UserService.getUserById(
        userId,
        req.userId!,
        req.userRole!
      );

      if (!result.success) {
        const statusCode = result.error === 'User not found' ? 404 : 500;
        res.status(statusCode).json({
          error: {
            code: result.error === 'User not found' ? 'USER_NOT_FOUND' : 'GET_USER_FAILED',
            message: result.error,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          user: result.user,
        },
      });
    } catch (error) {
      console.error('Get user route error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get user',
        },
      });
    }
  }
);

/**
 * PUT /users/:id
 * Update user
 */
router.put('/:id',
  authenticate,
  requireAuth,
  auditLog('UPDATE_USER', 'users'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const validation = updateUserSchema.safeParse(req.body);
      
      if (!validation.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: validation.error.errors,
          },
        });
        return;
      }

      // Users can only update their own profile unless they're Super Admin
      if (req.userRole !== UserRole.SUPER_ADMIN && req.userId !== userId) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied to update this user',
          },
        });
        return;
      }

      // Non-Super Admins cannot change role or isActive status
      if (req.userRole !== UserRole.SUPER_ADMIN) {
        delete validation.data.isActive;
      }

      const result = await UserService.updateUser(
        userId,
        validation.data,
        req.userId!,
        req.userRole!
      );

      if (!result.success) {
        const statusCode = result.error === 'User not found' ? 404 : 400;
        res.status(statusCode).json({
          error: {
            code: result.error === 'User not found' ? 'USER_NOT_FOUND' : 'UPDATE_USER_FAILED',
            message: result.error,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          user: result.user,
        },
      });
    } catch (error) {
      console.error('Update user route error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update user',
        },
      });
    }
  }
);

/**
 * DELETE /users/:id
 * Delete user (soft delete)
 */
router.delete('/:id',
  authenticate,
  requireSuperAdmin,
  auditLog('DELETE_USER', 'users'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;

      // Prevent self-deletion
      if (req.userId === userId) {
        res.status(400).json({
          error: {
            code: 'SELF_DELETE_NOT_ALLOWED',
            message: 'Cannot delete your own account',
          },
        });
        return;
      }

      const result = await UserService.deleteUser(
        userId,
        req.userId!,
        req.userRole!
      );

      if (!result.success) {
        const statusCode = result.error === 'User not found' ? 404 : 500;
        res.status(statusCode).json({
          error: {
            code: result.error === 'User not found' ? 'USER_NOT_FOUND' : 'DELETE_USER_FAILED',
            message: result.error,
          },
        });
        return;
      }

      res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      console.error('Delete user route error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete user',
        },
      });
    }
  }
);

/**
 * POST /users/:id/change-password
 * Change user password
 */
router.post('/:id/change-password',
  authenticate,
  requireAuth,
  auditLog('CHANGE_PASSWORD', 'users'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const validation = changePasswordSchema.safeParse(req.body);
      
      if (!validation.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: validation.error.errors,
          },
        });
        return;
      }

      // Users can only change their own password unless they're Super Admin
      if (req.userRole !== UserRole.SUPER_ADMIN && req.userId !== userId) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied to change this user\'s password',
          },
        });
        return;
      }

      // Non-admin users must provide current password when changing their own
      const isSuperAdminChangingOther = req.userRole === UserRole.SUPER_ADMIN && req.userId !== userId;
      if (!isSuperAdminChangingOther && !validation.data.currentPassword) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Current password is required',
          },
        });
        return;
      }

      const result = await UserService.changePassword(
        userId,
        validation.data.currentPassword || '',
        validation.data.newPassword,
        req.userId!,
        req.userRole!
      );

      if (!result.success) {
        const statusCode = result.error === 'User not found' ? 404 : 400;
        res.status(statusCode).json({
          error: {
            code: result.error === 'User not found' ? 'USER_NOT_FOUND' : 'CHANGE_PASSWORD_FAILED',
            message: result.error,
          },
        });
        return;
      }

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      console.error('Change password route error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to change password',
        },
      });
    }
  }
);

/**
 * GET /users/role/:role
 * Get users by role (Super Admin only)
 */
router.get('/role/:role',
  authenticate,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const role = req.params.role as UserRole;

      if (!Object.values(UserRole).includes(role)) {
        res.status(400).json({
          error: {
            code: 'INVALID_ROLE',
            message: 'Invalid user role',
          },
        });
        return;
      }

      const result = await UserService.getUsersByRole(
        role,
        req.userId!,
        req.userRole!
      );

      if (!result.success) {
        res.status(500).json({
          error: {
            code: 'GET_USERS_BY_ROLE_FAILED',
            message: result.error,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          users: result.users,
          role,
        },
      });
    } catch (error) {
      console.error('Get users by role route error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get users by role',
        },
      });
    }
  }
);

/**
 * POST /users/validate-password
 * Validate password strength
 */
router.post('/validate-password',
  async (req: Request, res: Response) => {
    try {
      const validation = validatePasswordSchema.safeParse(req.body);
      
      if (!validation.success) {
        res.status(400).json({
          error: {
            code: 'MISSING_PASSWORD',
            message: 'Password is required',
          },
        });
        return;
      }

      const { password } = validation.data;
      const errors: string[] = [];

      // Password strength validation
      if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
      }
      if (password.length > 128) {
        errors.push('Password must be less than 128 characters long');
      }
      if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
      }
      if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
      }
      if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number');
      }
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character');
      }

      const isValid = errors.length === 0;

      res.json({
        success: true,
        data: {
          valid: isValid,
          errors,
        },
      });
    } catch (error) {
      console.error('Validate password route error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to validate password',
        },
      });
    }
  }
);

export default router;