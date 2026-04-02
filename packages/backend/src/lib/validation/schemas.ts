/**
 * Comprehensive Validation Schemas
 * Field-level validation for all data types in the system
 */

import { z } from 'zod';
import { VALIDATION_PATTERNS, FIELD_LIMITS } from './types';

// Base validation schemas
export const baseSchemas = {
  // UUID validation
  uuid: z.string().regex(VALIDATION_PATTERNS.UUID, 'Invalid UUID format'),

  // Email validation with sanitization
  email: z.string()
    .min(FIELD_LIMITS.EMAIL.min, `Email must be at least ${FIELD_LIMITS.EMAIL.min} characters`)
    .max(FIELD_LIMITS.EMAIL.max, `Email must not exceed ${FIELD_LIMITS.EMAIL.max} characters`)
    .regex(VALIDATION_PATTERNS.EMAIL, 'Invalid email format')
    .transform(val => val.toLowerCase().trim()),

  // Password validation
  password: z.string()
    .min(FIELD_LIMITS.PASSWORD.min, `Password must be at least ${FIELD_LIMITS.PASSWORD.min} characters`)
    .max(FIELD_LIMITS.PASSWORD.max, `Password must not exceed ${FIELD_LIMITS.PASSWORD.max} characters`)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),

  // Name validation (supports Turkish characters)
  name: z.string()
    .min(FIELD_LIMITS.NAME.min, `Name must be at least ${FIELD_LIMITS.NAME.min} characters`)
    .max(FIELD_LIMITS.NAME.max, `Name must not exceed ${FIELD_LIMITS.NAME.max} characters`)
    .regex(VALIDATION_PATTERNS.TURKISH_TEXT, 'Name contains invalid characters')
    .transform(val => val.trim()),

  // Phone validation
  phone: z.string()
    .min(FIELD_LIMITS.PHONE.min, `Phone must be at least ${FIELD_LIMITS.PHONE.min} characters`)
    .max(FIELD_LIMITS.PHONE.max, `Phone must not exceed ${FIELD_LIMITS.PHONE.max} characters`)
    .regex(VALIDATION_PATTERNS.PHONE, 'Invalid phone number format')
    .transform(val => val.trim()),

  // URL slug validation
  urlSlug: z.string()
    .min(FIELD_LIMITS.URL_SLUG.min, `URL slug must be at least ${FIELD_LIMITS.URL_SLUG.min} characters`)
    .max(FIELD_LIMITS.URL_SLUG.max, `URL slug must not exceed ${FIELD_LIMITS.URL_SLUG.max} characters`)
    .regex(VALIDATION_PATTERNS.URL_SLUG, 'URL slug must contain only lowercase letters, numbers, and hyphens'),

  // TOTP code validation
  totpCode: z.string()
    .length(FIELD_LIMITS.TOTP_CODE.min, 'TOTP code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'TOTP code must contain only digits'),

  // Date validation
  futureDate: z.string()
    .datetime('Invalid date format')
    .refine(date => new Date(date) > new Date(), 'Date must be in the future'),

  pastOrPresentDate: z.string()
    .datetime('Invalid date format')
    .refine(date => new Date(date) <= new Date(), 'Date must be in the past or present'),

  // Safe text validation (prevents XSS)
  safeText: z.string()
    .regex(VALIDATION_PATTERNS.SAFE_HTML, 'Text contains potentially unsafe characters')
    .transform(val => val.trim()),
};

// User validation schemas
export const userSchemas = {
  createUser: z.object({
    email: baseSchemas.email,
    password: baseSchemas.password,
    firstName: baseSchemas.name,
    lastName: baseSchemas.name,
    phone: baseSchemas.phone.optional(),
    role: z.enum(['SUPER_ADMIN', 'CLUB_PRESIDENT', 'STUDENT']),
  }),

  updateUser: z.object({
    firstName: baseSchemas.name.optional(),
    lastName: baseSchemas.name.optional(),
    phone: baseSchemas.phone.optional(),
    isActive: z.boolean().optional(),
  }),

  login: z.object({
    email: baseSchemas.email,
    password: z.string().min(1, 'Password is required'),
    totpCode: baseSchemas.totpCode.optional(),
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: baseSchemas.password,
  }),

  resetPassword: z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: baseSchemas.password,
  }),
};

// Club validation schemas
export const clubSchemas = {
  createClub: z.object({
    name: z.string()
      .min(FIELD_LIMITS.CLUB_NAME.min, `Club name must be at least ${FIELD_LIMITS.CLUB_NAME.min} characters`)
      .max(FIELD_LIMITS.CLUB_NAME.max, `Club name must not exceed ${FIELD_LIMITS.CLUB_NAME.max} characters`)
      .regex(VALIDATION_PATTERNS.TURKISH_TEXT, 'Club name contains invalid characters')
      .transform(val => val.trim()),
    description: z.string()
      .max(FIELD_LIMITS.DESCRIPTION.max, `Description must not exceed ${FIELD_LIMITS.DESCRIPTION.max} characters`)
      .regex(VALIDATION_PATTERNS.SAFE_HTML, 'Description contains potentially unsafe characters')
      .transform(val => val.trim())
      .optional(),
    presidentEmail: baseSchemas.email,
    presidentFirstName: baseSchemas.name,
    presidentLastName: baseSchemas.name,
  }),

  updateClub: z.object({
    name: z.string()
      .min(FIELD_LIMITS.CLUB_NAME.min, `Club name must be at least ${FIELD_LIMITS.CLUB_NAME.min} characters`)
      .max(FIELD_LIMITS.CLUB_NAME.max, `Club name must not exceed ${FIELD_LIMITS.CLUB_NAME.max} characters`)
      .regex(VALIDATION_PATTERNS.TURKISH_TEXT, 'Club name contains invalid characters')
      .transform(val => val.trim())
      .optional(),
    description: z.string()
      .max(FIELD_LIMITS.DESCRIPTION.max, `Description must not exceed ${FIELD_LIMITS.DESCRIPTION.max} characters`)
      .regex(VALIDATION_PATTERNS.SAFE_HTML, 'Description contains potentially unsafe characters')
      .transform(val => val.trim())
      .optional(),
    isActive: z.boolean().optional(),
  }),
};

// Activity validation schemas
export const activitySchemas = {
  createActivity: z.object({
    title: z.string()
      .min(FIELD_LIMITS.ACTIVITY_TITLE.min, `Title must be at least ${FIELD_LIMITS.ACTIVITY_TITLE.min} characters`)
      .max(FIELD_LIMITS.ACTIVITY_TITLE.max, `Title must not exceed ${FIELD_LIMITS.ACTIVITY_TITLE.max} characters`)
      .regex(VALIDATION_PATTERNS.TURKISH_TEXT, 'Title contains invalid characters')
      .transform(val => val.trim()),
    description: z.string()
      .max(FIELD_LIMITS.DESCRIPTION.max, `Description must not exceed ${FIELD_LIMITS.DESCRIPTION.max} characters`)
      .regex(VALIDATION_PATTERNS.SAFE_HTML, 'Description contains potentially unsafe characters')
      .transform(val => val.trim())
      .optional(),
    startDate: baseSchemas.futureDate,
    endDate: baseSchemas.futureDate,
    location: z.string()
      .min(FIELD_LIMITS.LOCATION.min, `Location must be at least ${FIELD_LIMITS.LOCATION.min} characters`)
      .max(FIELD_LIMITS.LOCATION.max, `Location must not exceed ${FIELD_LIMITS.LOCATION.max} characters`)
      .regex(VALIDATION_PATTERNS.TURKISH_TEXT, 'Location contains invalid characters')
      .transform(val => val.trim()),
    maxParticipants: z.number().int().positive('Max participants must be a positive number').optional(),
    registrationEndDate: baseSchemas.futureDate.optional(),
  }).refine(data => new Date(data.endDate) > new Date(data.startDate), {
    message: 'End date must be after start date',
    path: ['endDate'],
  }),

  updateActivity: z.object({
    title: z.string()
      .min(FIELD_LIMITS.ACTIVITY_TITLE.min, `Title must be at least ${FIELD_LIMITS.ACTIVITY_TITLE.min} characters`)
      .max(FIELD_LIMITS.ACTIVITY_TITLE.max, `Title must not exceed ${FIELD_LIMITS.ACTIVITY_TITLE.max} characters`)
      .regex(VALIDATION_PATTERNS.TURKISH_TEXT, 'Title contains invalid characters')
      .transform(val => val.trim())
      .optional(),
    description: z.string()
      .max(FIELD_LIMITS.DESCRIPTION.max, `Description must not exceed ${FIELD_LIMITS.DESCRIPTION.max} characters`)
      .regex(VALIDATION_PATTERNS.SAFE_HTML, 'Description contains potentially unsafe characters')
      .transform(val => val.trim())
      .optional(),
    startDate: baseSchemas.futureDate.optional(),
    endDate: baseSchemas.futureDate.optional(),
    location: z.string()
      .min(FIELD_LIMITS.LOCATION.min, `Location must be at least ${FIELD_LIMITS.LOCATION.min} characters`)
      .max(FIELD_LIMITS.LOCATION.max, `Location must not exceed ${FIELD_LIMITS.LOCATION.max} characters`)
      .regex(VALIDATION_PATTERNS.TURKISH_TEXT, 'Location contains invalid characters')
      .transform(val => val.trim())
      .optional(),
    maxParticipants: z.number().int().positive('Max participants must be a positive number').optional(),
    registrationEndDate: baseSchemas.futureDate.optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED']).optional(),
  }).refine(data => {
    if (data.startDate && data.endDate) {
      return new Date(data.endDate) > new Date(data.startDate);
    }
    return true;
  }, {
    message: 'End date must be after start date',
    path: ['endDate'],
  }),
};

// Application validation schemas
export const applicationSchemas = {
  createApplication: z.object({
    clubId: baseSchemas.uuid,
    studentName: baseSchemas.name,
    studentEmail: baseSchemas.email,
    motivation: z.string()
      .min(FIELD_LIMITS.MOTIVATION.min, `Motivation must be at least ${FIELD_LIMITS.MOTIVATION.min} characters`)
      .max(FIELD_LIMITS.MOTIVATION.max, `Motivation must not exceed ${FIELD_LIMITS.MOTIVATION.max} characters`)
      .regex(VALIDATION_PATTERNS.SAFE_HTML, 'Motivation contains potentially unsafe characters')
      .transform(val => val.trim()),
  }),

  updateApplicationStatus: z.object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
    reviewComments: z.string()
      .max(FIELD_LIMITS.DESCRIPTION.max, `Review comments must not exceed ${FIELD_LIMITS.DESCRIPTION.max} characters`)
      .regex(VALIDATION_PATTERNS.SAFE_HTML, 'Review comments contain potentially unsafe characters')
      .transform(val => val.trim())
      .optional(),
  }),
};

// Query parameter validation schemas
export const querySchemas = {
  pagination: z.object({
    page: z.string().regex(/^\d+$/, 'Page must be a number').transform(val => parseInt(val, 10)).optional(),
    limit: z.string().regex(/^\d+$/, 'Limit must be a number').transform(val => parseInt(val, 10)).optional(),
  }),

  clubFilters: z.object({
    isActive: z.string().regex(/^(true|false)$/, 'isActive must be true or false').transform(val => val === 'true').optional(),
    search: baseSchemas.safeText.optional(),
  }),

  activityFilters: z.object({
    status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED']).optional(),
    startDate: z.string().datetime('Invalid start date format').optional(),
    endDate: z.string().datetime('Invalid end date format').optional(),
  }),

  applicationFilters: z.object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    clubId: baseSchemas.uuid.optional(),
  }),
};

// Export all schemas
export const validationSchemas = {
  base: baseSchemas,
  user: userSchemas,
  club: clubSchemas,
  activity: activitySchemas,
  application: applicationSchemas,
  query: querySchemas,
};