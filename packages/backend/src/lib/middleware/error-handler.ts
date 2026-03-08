/**
 * Comprehensive Error Handling Middleware
 * Provides centralized error handling with proper logging and user-friendly responses
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

// Error types
export enum ErrorCode {
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  MALICIOUS_CONTENT = 'MALICIOUS_CONTENT',
  
  // Authentication errors
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOTP_REQUIRED = 'TOTP_REQUIRED',
  TOTP_INVALID = 'TOTP_INVALID',
  
  // Authorization errors
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_ACCESS_DENIED = 'RESOURCE_ACCESS_DENIED',
  CLUB_ACCESS_DENIED = 'CLUB_ACCESS_DENIED',
  
  // Resource errors
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  RESOURCE_GONE = 'RESOURCE_GONE',
  
  // Database errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // External service errors
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  EMAIL_SERVICE_ERROR = 'EMAIL_SERVICE_ERROR',
  
  // System errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
}

// Custom error class
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: any;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error response interface
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId?: string;
  };
}

// Error handler class
export class ErrorHandler {
  /**
   * Main error handling middleware
   */
  static handle() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      // Generate request ID for tracking
      const requestId = req.headers['x-request-id'] as string || 
                       Math.random().toString(36).substring(2, 15);

      // Log error details
      ErrorHandler.logError(error, req, requestId);

      // Audit failed operations
      ErrorHandler.auditError(error, req, requestId);

      // Handle different error types
      const errorResponse = ErrorHandler.buildErrorResponse(error, requestId);
      
      res.status(errorResponse.statusCode).json({
        error: {
          code: errorResponse.code,
          message: errorResponse.message,
          details: errorResponse.details,
          timestamp: errorResponse.timestamp,
          requestId,
        },
      });
    };
  }

  /**
   * Build standardized error response
   */
  private static buildErrorResponse(error: Error, requestId: string) {
    // Handle custom app errors
    if (error instanceof AppError) {
      return {
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: error.timestamp,
      };
    }

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return {
        statusCode: 400,
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid request data',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        })),
        timestamp: new Date().toISOString(),
      };
    }

    // Handle Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return ErrorHandler.handlePrismaError(error);
    }

    if (error instanceof Prisma.PrismaClientUnknownRequestError) {
      return {
        statusCode: 500,
        code: ErrorCode.DATABASE_ERROR,
        message: 'Database operation failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString(),
      };
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return {
        statusCode: 400,
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid data provided',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString(),
      };
    }

    // Handle JWT errors
    if (error.name === 'JsonWebTokenError') {
      return {
        statusCode: 401,
        code: ErrorCode.TOKEN_INVALID,
        message: 'Invalid authentication token',
        details: undefined,
        timestamp: new Date().toISOString(),
      };
    }

    if (error.name === 'TokenExpiredError') {
      return {
        statusCode: 401,
        code: ErrorCode.TOKEN_EXPIRED,
        message: 'Authentication token has expired',
        details: undefined,
        timestamp: new Date().toISOString(),
      };
    }

    // Handle timeout errors
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      return {
        statusCode: 408,
        code: ErrorCode.TIMEOUT_ERROR,
        message: 'Request timeout',
        details: undefined,
        timestamp: new Date().toISOString(),
      };
    }

    // Default internal server error
    return {
      statusCode: 500,
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Handle Prisma-specific errors
   */
  private static handlePrismaError(error: Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        return {
          statusCode: 409,
          code: ErrorCode.RESOURCE_CONFLICT,
          message: 'Resource already exists',
          details: {
            field: error.meta?.target,
            constraint: 'unique',
          },
          timestamp: new Date().toISOString(),
        };

      case 'P2025': // Record not found
        return {
          statusCode: 404,
          code: ErrorCode.RESOURCE_NOT_FOUND,
          message: 'Resource not found',
          details: undefined,
          timestamp: new Date().toISOString(),
        };

      case 'P2003': // Foreign key constraint violation
        return {
          statusCode: 400,
          code: ErrorCode.CONSTRAINT_VIOLATION,
          message: 'Invalid reference to related resource',
          details: {
            field: error.meta?.field_name,
            constraint: 'foreign_key',
          },
          timestamp: new Date().toISOString(),
        };

      case 'P2014': // Required relation violation
        return {
          statusCode: 400,
          code: ErrorCode.CONSTRAINT_VIOLATION,
          message: 'Required relationship is missing',
          details: {
            relation: error.meta?.relation_name,
          },
          timestamp: new Date().toISOString(),
        };

      default:
        return {
          statusCode: 500,
          code: ErrorCode.DATABASE_ERROR,
          message: 'Database operation failed',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
          timestamp: new Date().toISOString(),
        };
    }
  }

  /**
   * Log error details
   */
  private static logError(error: Error, req: Request, requestId: string) {
    const errorLog = {
      requestId,
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.userId,
      userRole: req.userRole,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error instanceof AppError ? error.code : undefined,
        statusCode: error instanceof AppError ? error.statusCode : undefined,
      },
      body: req.method !== 'GET' ? req.body : undefined,
      params: req.params,
      query: req.query,
    };

    // Log based on error severity
    if (error instanceof AppError && error.statusCode < 500) {
      console.warn('Client Error:', JSON.stringify(errorLog, null, 2));
    } else {
      console.error('Server Error:', JSON.stringify(errorLog, null, 2));
    }

    // In production, send to external logging service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to logging service (e.g., Winston, Sentry, etc.)
      // loggingService.error(errorLog);
    }
  }

  /**
   * Audit error for security monitoring
   */
  private static async auditError(error: Error, req: Request, requestId: string) {
    try {
      // Only audit significant errors or security-related failures
      const shouldAudit = 
        error instanceof AppError && 
        (error.statusCode === 401 || error.statusCode === 403 || error.statusCode >= 500) ||
        error.name === 'JsonWebTokenError' ||
        error.name === 'TokenExpiredError';

      if (shouldAudit && req.userId) {
        // TODO: Implement audit logging when audit service is available
        console.log('Security audit:', {
          userId: req.userId,
          userRole: req.userRole || 'UNKNOWN',
          action: 'ERROR_OCCURRED',
          resource: req.originalUrl,
          error: {
            name: error.name,
            message: error.message,
            code: error instanceof AppError ? error.code : undefined,
          },
          requestId,
        });
      }
    } catch (auditError) {
      console.error('Failed to audit error:', auditError);
    }
  }

  /**
   * Create specific error types
   */
  static validationError(message: string, details?: any) {
    return new AppError(message, ErrorCode.VALIDATION_ERROR, 400, true, details);
  }

  static authenticationError(message: string = 'Authentication failed') {
    return new AppError(message, ErrorCode.AUTHENTICATION_FAILED, 401);
  }

  static authorizationError(message: string = 'Insufficient permissions') {
    return new AppError(message, ErrorCode.INSUFFICIENT_PERMISSIONS, 403);
  }

  static notFoundError(resource: string = 'Resource') {
    return new AppError(`${resource} not found`, ErrorCode.RESOURCE_NOT_FOUND, 404);
  }

  static conflictError(message: string) {
    return new AppError(message, ErrorCode.RESOURCE_CONFLICT, 409);
  }

  static businessRuleError(message: string, details?: any) {
    return new AppError(message, ErrorCode.BUSINESS_RULE_VIOLATION, 422, true, details);
  }

  static rateLimitError(message: string = 'Rate limit exceeded') {
    return new AppError(message, ErrorCode.RATE_LIMIT_EXCEEDED, 429);
  }

  static internalError(message: string = 'Internal server error') {
    return new AppError(message, ErrorCode.INTERNAL_SERVER_ERROR, 500, false);
  }
}

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default ErrorHandler;