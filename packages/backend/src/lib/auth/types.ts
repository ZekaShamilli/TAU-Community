/**
 * Authentication types and interfaces
 */

// Re-export UserRole from Prisma for convenience
export { UserRole } from '@prisma/client';
import { UserRole } from '@prisma/client';

export interface JWTPayload {
  userId: string;
  role: UserRole;
  clubId?: string; // Only for Club Presidents
  permissions: string[];
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export interface RefreshTokenData {
  userId: string;
  role: UserRole;
  clubId?: string;
  tokenFamily: string; // For token rotation
  version: number; // For invalidation
  iat: number;
  exp: number;
}

export interface BlacklistedToken {
  jti: string; // JWT ID
  userId: string;
  expiresAt: Date;
  reason: 'LOGOUT' | 'REFRESH' | 'SECURITY';
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  clubId?: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  totpEnabled: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
  totpCode?: string; // Required for Super Admins
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface TokenValidationResult {
  valid: boolean;
  payload?: JWTPayload;
  error?: string;
  expired?: boolean;
}

export interface RefreshTokenValidationResult {
  valid: boolean;
  payload?: RefreshTokenData;
  error?: string;
  expired?: boolean;
}

// Permission constants
export const PERMISSIONS = {
  // Club management
  CLUB_CREATE: 'club:create',
  CLUB_READ: 'club:read',
  CLUB_UPDATE: 'club:update',
  CLUB_DELETE: 'club:delete',
  CLUB_LIST_ALL: 'club:list:all',
  
  // Activity management
  ACTIVITY_CREATE: 'activity:create',
  ACTIVITY_READ: 'activity:read',
  ACTIVITY_UPDATE: 'activity:update',
  ACTIVITY_DELETE: 'activity:delete',
  
  // Application management
  APPLICATION_READ: 'application:read',
  APPLICATION_UPDATE: 'application:update',
  APPLICATION_SUBMIT: 'application:submit',
  
  // User management
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  
  // Content moderation
  CONTENT_MODERATE: 'content:moderate',
  CONTENT_FLAG: 'content:flag',
  
  // Audit and monitoring
  AUDIT_READ: 'audit:read',
  SYSTEM_MONITOR: 'system:monitor',
} as const;

// Role-based permissions mapping
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  SUPER_ADMIN: [
    PERMISSIONS.CLUB_CREATE,
    PERMISSIONS.CLUB_READ,
    PERMISSIONS.CLUB_UPDATE,
    PERMISSIONS.CLUB_DELETE,
    PERMISSIONS.CLUB_LIST_ALL,
    PERMISSIONS.ACTIVITY_CREATE,
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.ACTIVITY_UPDATE,
    PERMISSIONS.ACTIVITY_DELETE,
    PERMISSIONS.APPLICATION_READ,
    PERMISSIONS.APPLICATION_UPDATE,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_DELETE,
    PERMISSIONS.CONTENT_MODERATE,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.SYSTEM_MONITOR,
  ],
  CLUB_PRESIDENT: [
    PERMISSIONS.CLUB_READ,
    PERMISSIONS.CLUB_UPDATE, // Only their own club
    PERMISSIONS.ACTIVITY_CREATE,
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.ACTIVITY_UPDATE,
    PERMISSIONS.ACTIVITY_DELETE,
    PERMISSIONS.APPLICATION_READ,
    PERMISSIONS.APPLICATION_UPDATE,
    PERMISSIONS.USER_READ, // Limited scope
    PERMISSIONS.CONTENT_FLAG,
  ],
  STUDENT: [
    PERMISSIONS.CLUB_READ,
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.APPLICATION_SUBMIT,
    PERMISSIONS.USER_READ, // Own profile only
  ],
};

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];