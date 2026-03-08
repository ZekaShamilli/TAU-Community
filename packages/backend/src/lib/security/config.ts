/**
 * Security Configuration for TAU Community
 * Implements comprehensive security hardening measures
 */

import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Request } from 'express';

/**
 * Rate limiting configurations for different endpoint types
 */
export const rateLimitConfigs = {
  // General API rate limiting
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later.',
        timestamp: new Date().toISOString(),
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Strict rate limiting for authentication endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login attempts per windowMs
    message: {
      error: {
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts. Please try again later.',
        timestamp: new Date().toISOString(),
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
  }),

  // Very strict rate limiting for password reset
  passwordReset: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // limit each IP to 3 password reset attempts per hour
    message: {
      error: {
        code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
        message: 'Too many password reset attempts. Please try again later.',
        timestamp: new Date().toISOString(),
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Moderate rate limiting for content creation
  contentCreation: rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // limit each IP to 20 content creation requests per 5 minutes
    message: {
      error: {
        code: 'CONTENT_CREATION_RATE_LIMIT_EXCEEDED',
        message: 'Too many content creation attempts. Please slow down.',
        timestamp: new Date().toISOString(),
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Strict rate limiting for admin operations
  admin: rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 50, // limit each IP to 50 admin operations per 10 minutes
    message: {
      error: {
        code: 'ADMIN_RATE_LIMIT_EXCEEDED',
        message: 'Too many administrative operations. Please slow down.',
        timestamp: new Date().toISOString(),
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),
};

/**
 * Helmet security configuration
 */
export const helmetConfig = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      connectSrc: ["'self'"],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  
  // X-Frame-Options
  frameguard: {
    action: 'deny',
  },
  
  // X-Content-Type-Options
  noSniff: true,
  
  // X-XSS-Protection
  xssFilter: true,
  
  // Referrer Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
  
  // Hide X-Powered-By header
  hidePoweredBy: true,
  
  // DNS Prefetch Control
  dnsPrefetchControl: {
    allow: false,
  },
  
  // IE No Open
  ieNoOpen: true,
  
  // Permissions Policy
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: [],
    usb: [],
  },
});

/**
 * CORS configuration
 */
export const corsConfig = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.CORS_ORIGIN || 'http://localhost:3000',
      'http://localhost:3000',
      'https://tau-kays.edu',
      'https://www.tau-kays.edu',
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-CSRF-Token',
  ],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400, // 24 hours
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: any, next: any) => {
  // Additional security headers not covered by helmet
  res.setHeader('X-Request-ID', req.headers['x-request-id'] || generateRequestId());
  res.setHeader('X-Response-Time', Date.now());
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Security-specific headers
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  
  next();
};

/**
 * Generate unique request ID for tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Input sanitization configuration
 */
export const sanitizationConfig = {
  // Maximum request body size
  maxBodySize: '10mb',
  
  // Maximum URL length
  maxUrlLength: 2048,
  
  // Maximum header size
  maxHeaderSize: 8192,
  
  // Allowed file types for uploads
  allowedFileTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
  ],
  
  // Maximum file size for uploads
  maxFileSize: 5 * 1024 * 1024, // 5MB
};

/**
 * Security monitoring configuration
 */
export const securityMonitoring = {
  // Suspicious activity patterns
  suspiciousPatterns: [
    /\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b/i,
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /\b(eval|setTimeout|setInterval)\s*\(/gi,
  ],
  
  // IP addresses to monitor more closely
  watchedIPs: new Set<string>(),
  
  // Failed authentication attempt tracking
  failedAttempts: new Map<string, { count: number; lastAttempt: Date }>(),
  
  // Suspicious request tracking
  suspiciousRequests: new Map<string, { count: number; lastRequest: Date }>(),
};

/**
 * Validate request against security patterns
 */
export function validateRequestSecurity(req: Request): { isValid: boolean; violations: string[] } {
  const violations: string[] = [];
  
  // Check URL length
  if (req.url.length > sanitizationConfig.maxUrlLength) {
    violations.push('URL_TOO_LONG');
  }
  
  // Check for suspicious patterns in URL
  for (const pattern of securityMonitoring.suspiciousPatterns) {
    if (pattern.test(req.url)) {
      violations.push('SUSPICIOUS_URL_PATTERN');
      break;
    }
  }
  
  // Check request body for suspicious patterns
  if (req.body && typeof req.body === 'object') {
    const bodyString = JSON.stringify(req.body);
    for (const pattern of securityMonitoring.suspiciousPatterns) {
      if (pattern.test(bodyString)) {
        violations.push('SUSPICIOUS_BODY_CONTENT');
        break;
      }
    }
  }
  
  // Check headers for suspicious content
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') {
      for (const pattern of securityMonitoring.suspiciousPatterns) {
        if (pattern.test(value)) {
          violations.push('SUSPICIOUS_HEADER_CONTENT');
          break;
        }
      }
    }
  }
  
  return {
    isValid: violations.length === 0,
    violations,
  };
}

/**
 * Track failed authentication attempts
 */
export function trackFailedAuth(ip: string): boolean {
  const now = new Date();
  const existing = securityMonitoring.failedAttempts.get(ip);
  
  if (existing) {
    // Reset counter if last attempt was more than 1 hour ago
    if (now.getTime() - existing.lastAttempt.getTime() > 60 * 60 * 1000) {
      existing.count = 1;
    } else {
      existing.count++;
    }
    existing.lastAttempt = now;
  } else {
    securityMonitoring.failedAttempts.set(ip, { count: 1, lastAttempt: now });
  }
  
  const attempts = securityMonitoring.failedAttempts.get(ip)!;
  
  // Block IP if more than 10 failed attempts in 1 hour
  if (attempts.count > 10) {
    securityMonitoring.watchedIPs.add(ip);
    return true; // IP should be blocked
  }
  
  return false;
}

/**
 * Check if IP is blocked
 */
export function isIPBlocked(ip: string): boolean {
  return securityMonitoring.watchedIPs.has(ip);
}

/**
 * Security audit configuration
 */
export const securityAuditConfig = {
  // Events that should always be logged
  criticalEvents: [
    'LOGIN_ATTEMPT',
    'LOGIN_SUCCESS',
    'LOGIN_FAILURE',
    'PASSWORD_CHANGE',
    'PERMISSION_DENIED',
    'SUSPICIOUS_ACTIVITY',
    'RATE_LIMIT_EXCEEDED',
    'SECURITY_VIOLATION',
  ],
  
  // Retention period for security logs
  logRetentionDays: 90,
  
  // Alert thresholds
  alertThresholds: {
    failedLogins: 5,
    suspiciousRequests: 10,
    rateLimitViolations: 3,
  },
};