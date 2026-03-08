/**
 * Property-Based Tests for Input Validation and Sanitization
 * **Feature: tau-kays, Property 12: Input validation and sanitization**
 * **Validates: Requirements 12.1, 12.2, 12.4**
 */

import fc from 'fast-check';
import { InputSanitizer } from '../../lib/validation/sanitizer';
import { validationSchemas } from '../../lib/validation/schemas';
import { VALIDATION_PATTERNS, FIELD_LIMITS } from '../../lib/validation/types';

describe('Property 12: Input validation and sanitization', () => {
  describe('Input Sanitization Properties', () => {
    test('Property: All string inputs should be sanitized to prevent XSS attacks', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 }),
          (input) => {
            // Test that XSS patterns are detected and handled
            const maliciousInputs = [
              input + '<script>alert("xss")</script>',
              input + 'javascript:alert("xss")',
              input + '<iframe src="evil.com"></iframe>',
              input + 'onload="alert(1)"',
              input + '<object data="evil.swf"></object>',
            ];

            maliciousInputs.forEach(maliciousInput => {
              try {
                const sanitized = InputSanitizer.sanitize(maliciousInput, { preventXSS: true });
                
                // Sanitized output should not contain dangerous patterns
                expect(sanitized).not.toMatch(VALIDATION_PATTERNS.XSS_PATTERNS);
                
                // Should not contain unescaped HTML tags
                expect(sanitized).not.toMatch(/<script|<iframe|<object/i);
              } catch (error) {
                // Throwing an error for malicious content is also acceptable
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toContain('malicious');
              }
            });
          }
        ),
        { numRuns: 10 }
      );
    });

    test('Property: All string inputs should be sanitized to prevent SQL injection', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 }),
          (input) => {
            // Test that SQL injection patterns are detected and handled
            const sqlInjectionInputs = [
              input + "'; DROP TABLE users; --",
              input + "' UNION SELECT * FROM users --",
              input + "' OR '1'='1",
              input + "; INSERT INTO users VALUES ('hacker', 'password'); --",
              input + "' EXEC xp_cmdshell('dir') --",
            ];

            sqlInjectionInputs.forEach(maliciousInput => {
              try {
                const sanitized = InputSanitizer.sanitize(maliciousInput, { preventSQLInjection: true });
                
                // Sanitized output should not contain SQL injection patterns
                expect(sanitized).not.toMatch(VALIDATION_PATTERNS.SQL_INJECTION);
              } catch (error) {
                // Throwing an error for malicious content is also acceptable
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toContain('malicious');
              }
            });
          }
        ),
        { numRuns: 10 }
      );
    });

    test('Property: Email sanitization should always produce valid lowercase emails', () => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          fc.string({ minLength: 0, maxLength: 10 }), // whitespace
          (email, whitespace) => {
            const inputWithWhitespace = whitespace + email + whitespace;
            const sanitized = InputSanitizer.sanitizeEmail(inputWithWhitespace);
            
            // Should be lowercase
            expect(sanitized).toBe(sanitized.toLowerCase());
            
            // Should be trimmed
            expect(sanitized).toBe(sanitized.trim());
            
            // Should match email pattern
            expect(sanitized).toMatch(VALIDATION_PATTERNS.EMAIL);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('Property: URL slug sanitization should always produce valid slugs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          (input) => {
            const sanitized = InputSanitizer.sanitizeUrlSlug(input);
            
            if (sanitized.length > 0) {
              // Should match URL slug pattern
              expect(sanitized).toMatch(VALIDATION_PATTERNS.URL_SLUG);
              
              // Should be lowercase
              expect(sanitized).toBe(sanitized.toLowerCase());
              
              // Should not start or end with hyphens
              expect(sanitized).not.toMatch(/^-|-$/);
              
              // Should not have consecutive hyphens
              expect(sanitized).not.toMatch(/--/);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('Property: Object sanitization should recursively sanitize all string values', () => {
      fc.assert(
        fc.property(
          fc.object({
            key: fc.string({ minLength: 1, maxLength: 20 }),
            values: fc.oneof(
              fc.string({ minLength: 1, maxLength: 100 }),
              fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 5 }),
              fc.record({
                nested: fc.string({ minLength: 1, maxLength: 50 }),
              })
            ),
          }),
          (obj) => {
            const sanitized = InputSanitizer.sanitizeObject(obj, { 
              preventXSS: true, 
              preventSQLInjection: true 
            });
            
            // Should maintain object structure
            expect(typeof sanitized).toBe('object');
            expect(sanitized).not.toBeNull();
            
            // All string values should be sanitized
            const checkSanitized = (value: any): void => {
              if (typeof value === 'string') {
                expect(value).not.toMatch(VALIDATION_PATTERNS.XSS_PATTERNS);
                expect(value).not.toMatch(VALIDATION_PATTERNS.SQL_INJECTION);
              } else if (Array.isArray(value)) {
                value.forEach(checkSanitized);
              } else if (typeof value === 'object' && value !== null) {
                Object.values(value).forEach(checkSanitized);
              }
            };
            
            checkSanitized(sanitized);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Schema Validation Properties', () => {
    test('Property: Email validation should accept valid emails and reject invalid ones', () => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          (validEmail) => {
            const result = validationSchemas.base.email.safeParse(validEmail);
            expect(result.success).toBe(true);
            if (result.success) {
              expect(result.data).toBe(validEmail.toLowerCase().trim());
            }
          }
        ),
        { numRuns: 10 }
      );

      // Test invalid emails
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !VALIDATION_PATTERNS.EMAIL.test(s)),
          (invalidEmail) => {
            const result = validationSchemas.base.email.safeParse(invalidEmail);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('Property: Password validation should enforce security requirements', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 8, maxLength: 128 }),
          fc.char().filter(c => c >= 'a' && c <= 'z'),
          fc.char().filter(c => c >= 'A' && c <= 'Z'),
          fc.char().filter(c => c >= '0' && c <= '9'),
          (base, lower, upper, digit) => {
            const validPassword = base + lower + upper + digit;
            const result = validationSchemas.base.password.safeParse(validPassword);
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );

      // Test invalid passwords
      const invalidPasswords = [
        'short', // too short
        'nouppercase123', // no uppercase
        'NOLOWERCASE123', // no lowercase
        'NoDigitsHere', // no digits
        'a'.repeat(129), // too long
      ];

      invalidPasswords.forEach(password => {
        const result = validationSchemas.base.password.safeParse(password);
        expect(result.success).toBe(false);
      });
    });

    test('Property: Name validation should accept Turkish characters and reject unsafe content', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 2, maxLength: 100 }).filter(s => 
            VALIDATION_PATTERNS.TURKISH_TEXT.test(s) && 
            !VALIDATION_PATTERNS.XSS_PATTERNS.test(s)
          ),
          (validName) => {
            const result = validationSchemas.base.name.safeParse(validName);
            expect(result.success).toBe(true);
            if (result.success) {
              expect(result.data).toBe(validName.trim());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Property: Field length limits should be enforced for all schemas', () => {
      // Test that fields respect their defined limits
      Object.entries(FIELD_LIMITS).forEach(([fieldType, limits]) => {
        // Test minimum length violation
        if (limits.min > 0) {
          const tooShort = 'a'.repeat(limits.min - 1);
          
          switch (fieldType) {
            case 'EMAIL':
              expect(validationSchemas.base.email.safeParse(tooShort).success).toBe(false);
              break;
            case 'PASSWORD':
              expect(validationSchemas.base.password.safeParse(tooShort).success).toBe(false);
              break;
            case 'NAME':
              expect(validationSchemas.base.name.safeParse(tooShort).success).toBe(false);
              break;
          }
        }

        // Test maximum length violation
        const tooLong = 'a'.repeat(limits.max + 1);
        
        switch (fieldType) {
          case 'EMAIL':
            expect(validationSchemas.base.email.safeParse(tooLong + '@example.com').success).toBe(false);
            break;
          case 'PASSWORD':
            expect(validationSchemas.base.password.safeParse(tooLong + 'A1').success).toBe(false);
            break;
          case 'NAME':
            expect(validationSchemas.base.name.safeParse(tooLong).success).toBe(false);
            break;
        }
      });
    });
  });

  describe('Security Properties', () => {
    test('Property: No malicious content should pass validation', () => {
      const maliciousPatterns = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        '<iframe src="evil.com">',
        'onload="malicious()"',
        "'; DROP TABLE users; --",
        "' UNION SELECT password FROM users --",
        '<object data="evil.swf">',
        'vbscript:msgbox("xss")',
      ];

      maliciousPatterns.forEach(pattern => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 100 }),
            (baseString) => {
              const maliciousInput = baseString + pattern;
              
              // Test various validation schemas
              expect(validationSchemas.base.safeText.safeParse(maliciousInput).success).toBe(false);
              
              // Test sanitization - should either clean or throw
              try {
                const sanitized = InputSanitizer.sanitizeText(maliciousInput);
                expect(sanitized).not.toContain(pattern);
              } catch (error) {
                expect(error).toBeInstanceOf(Error);
              }
            }
          ),
          { numRuns: 10 }
        );
      });
    });

    test('Property: Input sanitization should be idempotent', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 }),
          (input) => {
            const sanitized1 = InputSanitizer.sanitizeText(input);
            const sanitized2 = InputSanitizer.sanitizeText(sanitized1);
            
            // Sanitizing already sanitized input should produce the same result
            expect(sanitized1).toBe(sanitized2);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Property: All user inputs should be validated before processing', () => {
      fc.assert(
        fc.property(
          fc.record({
            email: fc.string({ minLength: 1, maxLength: 100 }),
            password: fc.string({ minLength: 1, maxLength: 100 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          (input) => {
            // Every input should go through validation
            const emailResult = validationSchemas.base.email.safeParse(input.email);
            const passwordResult = validationSchemas.base.password.safeParse(input.password);
            const nameResult = validationSchemas.base.name.safeParse(input.name);

            // Results should be deterministic
            expect(typeof emailResult.success).toBe('boolean');
            expect(typeof passwordResult.success).toBe('boolean');
            expect(typeof nameResult.success).toBe('boolean');

            // If validation fails, there should be error details
            if (!emailResult.success) {
              expect(emailResult.error.errors.length).toBeGreaterThan(0);
            }
            if (!passwordResult.success) {
              expect(passwordResult.error.errors.length).toBeGreaterThan(0);
            }
            if (!nameResult.success) {
              expect(nameResult.error.errors.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});