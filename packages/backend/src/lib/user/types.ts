/**
 * User service types and interfaces
 */

import { UserRole } from '@prisma/client';

export interface CreateUserRequest {
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
  clubId?: string; // Required when creating Club President
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  isActive?: boolean; // Super Admin only
  role?: UserRole; // Super Admin only
  clubId?: string; // Used when changing role to Club President
}

export interface PasswordChangeRequest {
  currentPassword?: string; // Required when changing own password
  newPassword: string;
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
  clubId?: string; // Only for Club Presidents
  clubName?: string; // Only for Club Presidents
}

export interface UserFilters {
  role?: UserRole;
  isActive?: boolean;
  email?: string;
  name?: string; // Searches both firstName and lastName
  clubId?: string; // Super Admin only
  limit?: number;
  offset?: number;
}

export interface UserServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Validation schemas for user data
export interface UserValidationRules {
  email: {
    required: true;
    format: 'email';
    maxLength: 255;
  };
  password: {
    required: true;
    minLength: 8;
    maxLength: 128;
    pattern: {
      lowercase: boolean;
      uppercase: boolean;
      number: boolean;
      special: boolean;
    };
  };
  firstName: {
    required: true;
    minLength: 2;
    maxLength: 100;
  };
  lastName: {
    required: true;
    minLength: 2;
    maxLength: 100;
  };
  phone: {
    required: false;
    pattern: string; // Phone number regex
    minLength: 10;
    maxLength: 20;
  };
}

// Role management types
export interface RoleChangeRequest {
  userId: string;
  newRole: UserRole;
  clubId?: string; // Required when changing to Club President
  reason?: string;
}

export interface RoleChangeResult {
  success: boolean;
  previousRole?: UserRole;
  newRole?: UserRole;
  clubAssignment?: {
    clubId: string;
    clubName: string;
  };
  error?: string;
}

// User statistics and analytics
export interface UserStatistics {
  totalUsers: number;
  activeUsers: number;
  usersByRole: {
    [key in UserRole]: number;
  };
  recentRegistrations: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  clubPresidentsWithoutClubs: number;
}

// Bulk operations
export interface BulkUserOperation {
  operation: 'activate' | 'deactivate' | 'delete' | 'changeRole';
  userIds: string[];
  parameters?: {
    newRole?: UserRole;
    clubId?: string;
  };
}

export interface BulkOperationResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: Array<{
    userId: string;
    error: string;
  }>;
}

// User profile management
export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  clubInfo?: {
    id: string;
    name: string;
    urlSlug: string;
  };
  preferences: {
    emailNotifications: boolean;
    language: string;
    timezone: string;
  };
  lastLogin?: Date;
  loginCount: number;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  preferences?: {
    emailNotifications?: boolean;
    language?: string;
    timezone?: string;
  };
}

// User activity and audit
export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  details?: any;
}

export interface UserActivityFilters {
  userId?: string;
  action?: string;
  resource?: string;
  dateFrom?: Date;
  dateTo?: Date;
  success?: boolean;
  limit?: number;
  offset?: number;
}

// Password management
export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireLowercase: boolean;
  requireUppercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventCommonPasswords: boolean;
  preventReuse: number; // Number of previous passwords to check
}

export interface PasswordStrengthResult {
  score: number; // 0-4 (weak to strong)
  feedback: string[];
  isValid: boolean;
}

// User session management
export interface UserSession {
  id: string;
  userId: string;
  deviceInfo: {
    userAgent: string;
    ipAddress: string;
    location?: string;
  };
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

export interface SessionManagementResult {
  activeSessions: UserSession[];
  totalSessions: number;
  revokedSessions: number;
}