/**
 * Input Sanitization System
 * Prevents XSS, SQL injection, and other security vulnerabilities
 */

import { SanitizationOptions, VALIDATION_PATTERNS } from './types';

export class InputSanitizer {
  /**
   * Sanitize input based on provided options
   */
  static sanitize(input: string, options: SanitizationOptions = {}): string {
    if (typeof input !== 'string') {
      return String(input);
    }

    let sanitized = input;

    // Trim whitespace
    if (options.trimWhitespace !== false) {
      sanitized = sanitized.trim();
    }

    // Normalize Unicode characters
    if (options.normalizeUnicode) {
      sanitized = sanitized.normalize('NFC');
    }

    // Prevent XSS attacks
    if (options.preventXSS !== false) {
      sanitized = this.preventXSS(sanitized);
    }

    // Prevent SQL injection
    if (options.preventSQLInjection !== false) {
      sanitized = this.preventSQLInjection(sanitized);
    }

    // Strip HTML tags
    if (options.stripHtml) {
      sanitized = this.stripHtml(sanitized);
    }

    return sanitized;
  }

  /**
   * Prevent XSS attacks by encoding dangerous characters
   */
  private static preventXSS(input: string): string {
    // Check for XSS patterns
    if (VALIDATION_PATTERNS.XSS_PATTERNS.test(input)) {
      throw new Error('Potentially malicious content detected');
    }

    // Encode HTML entities
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Prevent SQL injection by detecting dangerous patterns
   */
  private static preventSQLInjection(input: string): string {
    if (VALIDATION_PATTERNS.SQL_INJECTION.test(input)) {
      throw new Error('Potentially malicious SQL content detected');
    }
    return input;
  }

  /**
   * Strip HTML tags from input
   */
  private static stripHtml(input: string): string {
    return input.replace(/<[^>]*>/g, '');
  }

  /**
   * Sanitize email input
   */
  static sanitizeEmail(email: string): string {
    return this.sanitize(email, {
      trimWhitespace: true,
      preventXSS: true,
      preventSQLInjection: true,
    }).toLowerCase();
  }

  /**
   * Sanitize text input (names, descriptions, etc.)
   */
  static sanitizeText(text: string): string {
    return this.sanitize(text, {
      trimWhitespace: true,
      normalizeUnicode: true,
      preventXSS: true,
      preventSQLInjection: true,
    });
  }

  /**
   * Sanitize HTML content (for rich text fields)
   */
  static sanitizeHtml(html: string): string {
    return this.sanitize(html, {
      trimWhitespace: true,
      preventXSS: true,
      preventSQLInjection: true,
      stripHtml: true,
    });
  }

  /**
   * Sanitize URL slug
   */
  static sanitizeUrlSlug(slug: string): string {
    return this.sanitize(slug, {
      trimWhitespace: true,
      preventXSS: true,
      preventSQLInjection: true,
    })
      .toLowerCase()
      .replace(/[^a-z0-9\-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Sanitize phone number
   */
  static sanitizePhone(phone: string): string {
    return this.sanitize(phone, {
      trimWhitespace: true,
      preventXSS: true,
      preventSQLInjection: true,
    }).replace(/[^\d\+\-\(\)\s]/g, '');
  }

  /**
   * Validate and sanitize object recursively
   */
  static sanitizeObject(obj: any, options: SanitizationOptions = {}): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitize(obj, options);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, options));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value, options);
      }
      return sanitized;
    }

    return obj;
  }
}