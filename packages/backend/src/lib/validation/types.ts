/**
 * Validation types and interfaces
 */

import { z } from 'zod';

export interface ValidationResult<T = any> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface SanitizationOptions {
  stripHtml?: boolean;
  trimWhitespace?: boolean;
  normalizeUnicode?: boolean;
  preventXSS?: boolean;
  preventSQLInjection?: boolean;
}

export interface BusinessRuleContext {
  userId?: string;
  userRole?: string;
  clubId?: string;
  resourceId?: string;
}

export type ValidationSchema<T = any> = z.ZodSchema<T>;

export interface ValidationConfig {
  schema: ValidationSchema;
  sanitize?: SanitizationOptions;
  businessRules?: BusinessRule[];
}

export interface BusinessRule {
  name: string;
  validate: (data: any, context: BusinessRuleContext) => Promise<boolean>;
  message: string;
  code: string;
}

// Common validation patterns
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[\d\s\-\(\)]{10,15}$/,
  URL_SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  TURKISH_TEXT: /^[\p{L}\p{N}\p{P}\p{Z}]+$/u,
  SAFE_HTML: /^[^<>]*$/,
  SQL_INJECTION: /(union|select|insert|update|delete|drop|create|alter|exec|execute|script|javascript|vbscript|onload|onerror|onclick)/i,
  XSS_PATTERNS: /(<script|javascript:|vbscript:|onload=|onerror=|onclick=|<iframe|<object|<embed)/i,
} as const;

// Field length limits
export const FIELD_LIMITS = {
  EMAIL: { min: 5, max: 255 },
  PASSWORD: { min: 8, max: 128 },
  NAME: { min: 2, max: 100 },
  CLUB_NAME: { min: 3, max: 200 },
  ACTIVITY_TITLE: { min: 5, max: 300 },
  DESCRIPTION: { min: 0, max: 2000 },
  MOTIVATION: { min: 50, max: 1000 },
  PHONE: { min: 10, max: 20 },
  URL_SLUG: { min: 3, max: 200 },
  TOTP_CODE: { min: 6, max: 6 },
  LOCATION: { min: 2, max: 200 },
} as const;