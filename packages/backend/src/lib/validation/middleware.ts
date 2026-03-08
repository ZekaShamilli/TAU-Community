/**
 * Validation Middleware
 * Express middleware for request validation and sanitization
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { InputSanitizer } from './sanitizer';
import { BusinessRuleValidator, businessRuleSets } from './business-rules';
import { ValidationConfig, ValidationResult, BusinessRule, BusinessRuleContext } from './types';

// Extend Express Request type to include validated data
declare global {
  namespace Express {
    interface Request {
      validatedData?: any;
      sanitizedData?: any;
    }
  }
}

export class ValidationMiddleware {
  /**
   * Create validation middleware for a specific schema
   */
  static validate(config: ValidationConfig) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Extract data from request (body, params, query)
        const data = {
          ...req.body,
          ...req.params,
          ...req.query,
        };

        // Sanitize input data
        const sanitizedData = config.sanitize 
          ? InputSanitizer.sanitizeObject(data, config.sanitize)
          : data;

        // Validate against schema
        const schemaResult = config.schema.safeParse(sanitizedData);
        
        if (!schemaResult.success) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: schemaResult.error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message,
                code: err.code,
              })),
            },
          });
        }

        // Validate business rules if provided
        if (config.businessRules && config.businessRules.length > 0) {
          const context: BusinessRuleContext = {
            userId: req.userId,
            userRole: req.userRole,
            clubId: req.clubId,
            resourceId: req.params.id,
          };

          const businessRuleResult = await BusinessRuleValidator.validateRules(
            schemaResult.data,
            config.businessRules,
            context
          );

          if (!businessRuleResult.valid) {
            return res.status(422).json({
              error: {
                code: 'BUSINESS_RULE_VIOLATION',
                message: 'Business rule validation failed',
                details: businessRuleResult.errors,
              },
            });
          }
        }

        // Attach validated and sanitized data to request
        req.validatedData = schemaResult.data;
        req.sanitizedData = sanitizedData;

        next();
      } catch (error) {
        console.error('Validation middleware error:', error);
        
        // Check if it's a sanitization error (malicious content)
        if (error instanceof Error && error.message.includes('malicious')) {
          return res.status(400).json({
            error: {
              code: 'MALICIOUS_CONTENT',
              message: 'Request contains potentially malicious content',
            },
          });
        }

        res.status(500).json({
          error: {
            code: 'VALIDATION_SERVICE_ERROR',
            message: 'Validation service error',
          },
        });
      }
    };
  }

  /**
   * Validate request body only
   */
  static validateBody(schema: z.ZodSchema, businessRules?: BusinessRule[]) {
    return ValidationMiddleware.validate({
      schema,
      businessRules,
      sanitize: {
        trimWhitespace: true,
        preventXSS: true,
        preventSQLInjection: true,
      },
    });
  }

  /**
   * Validate request parameters only
   */
  static validateParams(schema: z.ZodSchema) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = schema.safeParse(req.params);
        
        if (!result.success) {
          return res.status(400).json({
            error: {
              code: 'INVALID_PARAMETERS',
              message: 'Invalid request parameters',
              details: result.error.errors,
            },
          });
        }

        req.validatedData = { ...req.validatedData, ...result.data };
        next();
      } catch (error) {
        console.error('Parameter validation error:', error);
        res.status(500).json({
          error: {
            code: 'VALIDATION_SERVICE_ERROR',
            message: 'Parameter validation service error',
          },
        });
      }
    };
  }

  /**
   * Validate query parameters only
   */
  static validateQuery(schema: z.ZodSchema) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = schema.safeParse(req.query);
        
        if (!result.success) {
          return res.status(400).json({
            error: {
              code: 'INVALID_QUERY_PARAMETERS',
              message: 'Invalid query parameters',
              details: result.error.errors,
            },
          });
        }

        req.validatedData = { ...req.validatedData, ...result.data };
        next();
      } catch (error) {
        console.error('Query validation error:', error);
        res.status(500).json({
          error: {
            code: 'VALIDATION_SERVICE_ERROR',
            message: 'Query validation service error',
          },
        });
      }
    };
  }

  /**
   * Comprehensive validation for body, params, and query
   */
  static validateAll(config: {
    body?: z.ZodSchema;
    params?: z.ZodSchema;
    query?: z.ZodSchema;
    businessRules?: BusinessRule[];
  }) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const validatedData: any = {};
        const errors: any[] = [];

        // Validate body
        if (config.body) {
          const sanitizedBody = InputSanitizer.sanitizeObject(req.body, {
            trimWhitespace: true,
            preventXSS: true,
            preventSQLInjection: true,
          });

          const bodyResult = config.body.safeParse(sanitizedBody);
          if (!bodyResult.success) {
            errors.push(...bodyResult.error.errors);
          } else {
            validatedData.body = bodyResult.data;
          }
        }

        // Validate params
        if (config.params) {
          const paramsResult = config.params.safeParse(req.params);
          if (!paramsResult.success) {
            errors.push(...paramsResult.error.errors);
          } else {
            validatedData.params = paramsResult.data;
          }
        }

        // Validate query
        if (config.query) {
          const queryResult = config.query.safeParse(req.query);
          if (!queryResult.success) {
            errors.push(...queryResult.error.errors);
          } else {
            validatedData.query = queryResult.data;
          }
        }

        // Return validation errors if any
        if (errors.length > 0) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: errors.map(err => ({
                field: err.path.join('.'),
                message: err.message,
                code: err.code,
              })),
            },
          });
        }

        // Validate business rules
        if (config.businessRules && config.businessRules.length > 0) {
          const allData = { ...validatedData.body, ...validatedData.params, ...validatedData.query };
          const context: BusinessRuleContext = {
            userId: req.userId,
            userRole: req.userRole,
            clubId: req.clubId,
            resourceId: req.params.id,
          };

          const businessRuleResult = await BusinessRuleValidator.validateRules(
            allData,
            config.businessRules,
            context
          );

          if (!businessRuleResult.valid) {
            return res.status(422).json({
              error: {
                code: 'BUSINESS_RULE_VIOLATION',
                message: 'Business rule validation failed',
                details: businessRuleResult.errors,
              },
            });
          }
        }

        // Attach validated data to request
        req.validatedData = validatedData;
        next();
      } catch (error) {
        console.error('Comprehensive validation error:', error);
        
        if (error instanceof Error && error.message.includes('malicious')) {
          return res.status(400).json({
            error: {
              code: 'MALICIOUS_CONTENT',
              message: 'Request contains potentially malicious content',
            },
          });
        }

        res.status(500).json({
          error: {
            code: 'VALIDATION_SERVICE_ERROR',
            message: 'Validation service error',
          },
        });
      }
    };
  }
}

// Convenience functions for common validation patterns
export const validate = ValidationMiddleware.validate;
export const validateBody = ValidationMiddleware.validateBody;
export const validateParams = ValidationMiddleware.validateParams;
export const validateQuery = ValidationMiddleware.validateQuery;
export const validateAll = ValidationMiddleware.validateAll;