/**
 * Business Rule Validation
 * Validates business logic constraints and data integrity rules
 */

import { DatabaseUtils, db } from '../database';
import { BusinessRule, BusinessRuleContext } from './types';

export class BusinessRuleValidator {
  /**
   * Validate all business rules for given data
   */
  static async validateRules(
    data: any,
    rules: BusinessRule[],
    context: BusinessRuleContext
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const rule of rules) {
      try {
        const isValid = await rule.validate(data, context);
        if (!isValid) {
          errors.push(rule.message);
        }
      } catch (error) {
        console.error(`Business rule validation error for ${rule.name}:`, error);
        errors.push(`Validation error: ${rule.message}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Common business rules
export const businessRules = {
  // User business rules
  uniqueEmail: {
    name: 'uniqueEmail',
    validate: async (data: { email: string }, context: BusinessRuleContext): Promise<boolean> => {
      const existingUser = await db.getClient().$queryRaw<Array<{ id: string }>>`
        SELECT id FROM users WHERE email = ${data.email} AND id != ${context.userId || ''}::uuid
      `;
      return existingUser.length === 0;
    },
    message: 'Email address is already in use',
    code: 'EMAIL_NOT_UNIQUE',
  } as BusinessRule,

  // Club business rules
  uniqueClubName: {
    name: 'uniqueClubName',
    validate: async (data: { name: string }, context: BusinessRuleContext): Promise<boolean> => {
      const existingClub = await db.getClient().$queryRaw<Array<{ id: string }>>`
        SELECT id FROM clubs WHERE name = ${data.name} AND id != ${context.resourceId || ''}::uuid
      `;
      return existingClub.length === 0;
    },
    message: 'Club name is already in use',
    code: 'CLUB_NAME_NOT_UNIQUE',
  } as BusinessRule,

  uniqueClubSlug: {
    name: 'uniqueClubSlug',
    validate: async (data: { urlSlug: string }, context: BusinessRuleContext): Promise<boolean> => {
      const existingClub = await db.getClient().$queryRaw<Array<{ id: string }>>`
        SELECT id FROM clubs WHERE url_slug = ${data.urlSlug} AND id != ${context.resourceId || ''}::uuid
      `;
      return existingClub.length === 0;
    },
    message: 'Club URL slug is already in use',
    code: 'CLUB_SLUG_NOT_UNIQUE',
  } as BusinessRule,

  // Activity business rules
  validActivityDates: {
    name: 'validActivityDates',
    validate: async (data: { startDate: string; endDate: string }): Promise<boolean> => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const now = new Date();
      
      // Start date must be in the future
      if (start <= now) {
        return false;
      }
      
      // End date must be after start date
      if (end <= start) {
        return false;
      }
      
      return true;
    },
    message: 'Activity dates must be valid and in the future',
    code: 'INVALID_ACTIVITY_DATES',
  } as BusinessRule,

  clubPresidentOwnsActivity: {
    name: 'clubPresidentOwnsActivity',
    validate: async (data: any, context: BusinessRuleContext): Promise<boolean> => {
      if (context.userRole !== 'CLUB_PRESIDENT') {
        return true; // Rule doesn't apply to non-club presidents
      }

      // For activity creation, check if user is president of the target club
      if (data.clubId) {
        const club = await db.getClient().$queryRaw<Array<{ president_id: string }>>`
          SELECT president_id FROM clubs WHERE id = ${data.clubId}::uuid
        `;
        return club.length > 0 && club[0]!.president_id === context.userId;
      }

      // For activity updates, check if user owns the activity's club
      if (context.resourceId) {
        const activity = await db.getClient().$queryRaw<Array<{ president_id: string }>>`
          SELECT c.president_id FROM activities a JOIN clubs c ON a.club_id = c.id WHERE a.id = ${context.resourceId}::uuid
        `;
        return activity.length > 0 && activity[0]!.president_id === context.userId;
      }

      return false;
    },
    message: 'Club Presidents can only manage activities for their own club',
    code: 'UNAUTHORIZED_CLUB_ACCESS',
  } as BusinessRule,

  // Application business rules
  noDuplicateApplications: {
    name: 'noDuplicateApplications',
    validate: async (data: { clubId: string; studentEmail: string }): Promise<boolean> => {
      const existingApplication = await db.getClient().$queryRaw<Array<{ id: string }>>`
        SELECT id FROM applications WHERE club_id = ${data.clubId}::uuid AND student_email = ${data.studentEmail} AND status = 'PENDING'::application_status
      `;
      return existingApplication.length === 0;
    },
    message: 'You already have a pending application for this club',
    code: 'DUPLICATE_APPLICATION',
  } as BusinessRule,

  clubAcceptsApplications: {
    name: 'clubAcceptsApplications',
    validate: async (data: { clubId: string }): Promise<boolean> => {
      const club = await db.getClient().$queryRaw<Array<{ is_active: boolean }>>`
        SELECT is_active FROM clubs WHERE id = ${data.clubId}::uuid
      `;
      return club.length > 0 && club[0]!.is_active;
    },
    message: 'This club is not currently accepting applications',
    code: 'CLUB_NOT_ACCEPTING_APPLICATIONS',
  } as BusinessRule,

  // Authorization business rules
  superAdminAccess: {
    name: 'superAdminAccess',
    validate: async (data: any, context: BusinessRuleContext): Promise<boolean> => {
      return context.userRole === 'SUPER_ADMIN';
    },
    message: 'Super Admin access required',
    code: 'SUPER_ADMIN_REQUIRED',
  } as BusinessRule,

  clubPresidentAccess: {
    name: 'clubPresidentAccess',
    validate: async (data: any, context: BusinessRuleContext): Promise<boolean> => {
      return context.userRole === 'CLUB_PRESIDENT' || context.userRole === 'SUPER_ADMIN';
    },
    message: 'Club President or Super Admin access required',
    code: 'CLUB_PRESIDENT_REQUIRED',
  } as BusinessRule,

  ownClubAccess: {
    name: 'ownClubAccess',
    validate: async (data: any, context: BusinessRuleContext): Promise<boolean> => {
      if (context.userRole === 'SUPER_ADMIN') {
        return true;
      }

      if (context.userRole === 'CLUB_PRESIDENT') {
        // Check if the resource belongs to the user's club
        const resourceClubId = data.clubId || context.resourceId;
        return resourceClubId === context.clubId;
      }

      return false;
    },
    message: 'Access denied: You can only access your own club resources',
    code: 'OWN_CLUB_ACCESS_REQUIRED',
  } as BusinessRule,

  // Data integrity rules
  referentialIntegrity: {
    name: 'referentialIntegrity',
    validate: async (data: any, context: BusinessRuleContext): Promise<boolean> => {
      // Check if referenced entities exist
      if (data.clubId) {
        const club = await db.getClient().$queryRaw<Array<{ id: string }>>`
          SELECT id FROM clubs WHERE id = ${data.clubId}::uuid
        `;
        if (club.length === 0) {
          return false;
        }
      }

      if (data.userId) {
        const user = await db.getClient().$queryRaw<Array<{ id: string }>>`
          SELECT id FROM users WHERE id = ${data.userId}::uuid
        `;
        if (user.length === 0) {
          return false;
        }
      }

      return true;
    },
    message: 'Referenced entity does not exist',
    code: 'REFERENTIAL_INTEGRITY_VIOLATION',
  } as BusinessRule,
};

// Business rule sets for different operations
export const businessRuleSets = {
  createUser: [businessRules.uniqueEmail],
  updateUser: [businessRules.uniqueEmail],
  
  createClub: [businessRules.uniqueClubName, businessRules.uniqueClubSlug],
  updateClub: [businessRules.uniqueClubName, businessRules.uniqueClubSlug],
  
  createActivity: [
    businessRules.validActivityDates,
    businessRules.clubPresidentOwnsActivity,
    businessRules.referentialIntegrity,
  ],
  updateActivity: [
    businessRules.validActivityDates,
    businessRules.clubPresidentOwnsActivity,
    businessRules.referentialIntegrity,
  ],
  
  createApplication: [
    businessRules.noDuplicateApplications,
    businessRules.clubAcceptsApplications,
    businessRules.referentialIntegrity,
  ],
  
  // Authorization rule sets
  superAdminOnly: [businessRules.superAdminAccess],
  clubPresidentOrAdmin: [businessRules.clubPresidentAccess],
  ownClubOnly: [businessRules.ownClubAccess],
};