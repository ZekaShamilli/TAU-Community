# Two-Factor Authentication (2FA) Implementation

## Overview

This document describes the complete implementation of Two-Factor Authentication (2FA) for Super Admins in the TAU KAYS system. The implementation uses Time-based One-Time Passwords (TOTP) with QR code generation for easy setup with authenticator apps.

## Features Implemented

### 1. TOTP Generation and Validation
- **Library**: `speakeasy` for TOTP generation and validation
- **QR Code Generation**: `qrcode` library for generating QR code images
- **Secret Generation**: 32-character base32 secrets for enhanced security
- **Time Window**: 2-step window (60 seconds) for clock drift tolerance

### 2. QR Code Generation
- **OTPAuth URL**: Standard `otpauth://` URL format for authenticator apps
- **QR Code Image**: Base64-encoded PNG images for easy display
- **Manual Entry**: Base32 secret for manual entry in authenticator apps
- **Issuer**: Configurable issuer name (defaults to "TAU KAYS")

### 3. Super Admin 2FA Enforcement
- **Login Requirement**: Super Admins must have 2FA enabled to login
- **TOTP Validation**: TOTP code required for every Super Admin login
- **Account Creation**: New Super Admin accounts require 2FA setup
- **Middleware Protection**: Optional middleware for additional route protection

### 4. Authentication Flow
```
1. Super Admin enters credentials
2. System validates username/password
3. System checks if TOTP is enabled
4. If not enabled: Return error requiring 2FA setup
5. If enabled: Require TOTP code
6. Validate TOTP code with 2-step window
7. Generate JWT tokens on successful validation
```

## API Endpoints

### Generate TOTP Secret
```http
POST /auth/totp/generate
Authorization: Bearer <access-token>

Response:
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEHPK3PXP...",
    "qrCodeUrl": "otpauth://totp/user@example.com?secret=...",
    "qrCodeDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "manualEntryKey": "JBSWY3DPEHPK3PXP..."
  }
}
```

### Enable TOTP
```http
POST /auth/totp/enable
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "secret": "JBSWY3DPEHPK3PXP...",
  "token": "123456"
}

Response:
{
  "success": true,
  "message": "Two-factor authentication enabled successfully"
}
```

### Disable TOTP
```http
POST /auth/totp/disable
Authorization: Bearer <access-token>

Response:
{
  "success": true,
  "message": "Two-factor authentication disabled successfully"
}
```

### Login with 2FA
```http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "password123",
  "totpCode": "123456"
}

Response:
{
  "success": true,
  "data": {
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900,
      "refreshExpiresIn": 604800
    },
    "user": {
      "id": "user-id",
      "email": "admin@example.com",
      "role": "SUPER_ADMIN",
      "totpEnabled": true
    }
  }
}
```

## Middleware Implementation

### TOTP Validation Middleware
```typescript
import { requireTOTP } from '../lib/middleware/auth';

// Apply to routes that require 2FA for Super Admins
router.get('/admin/sensitive-data', 
  authenticate,
  requireTOTP,
  getSensitiveData
);
```

The `requireTOTP` middleware:
- Allows non-Super Admin users to pass through
- Checks if Super Admin has TOTP enabled
- Denies access if TOTP is not enabled
- Logs unauthorized access attempts

## Database Schema

### User Table Updates
```sql
ALTER TABLE users ADD COLUMN totp_secret VARCHAR(32);
ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN DEFAULT false;
```

### Audit Logging
All 2FA-related actions are logged:
- `TOTP_ENABLED`: When 2FA is enabled
- `TOTP_DISABLED`: When 2FA is disabled
- `TOTP_FAILED`: When TOTP validation fails
- `TOTP_NOT_ENABLED`: When Super Admin tries to access protected resource without 2FA

## Security Features

### 1. Rate Limiting
- Login attempts are rate-limited (5 attempts per 15 minutes)
- TOTP generation is rate-limited (10 attempts per 15 minutes)

### 2. Audit Logging
- All authentication attempts are logged
- Failed TOTP attempts are tracked
- Unauthorized access attempts are recorded

### 3. Token Security
- JWT tokens include TOTP status
- Tokens are invalidated on logout
- Refresh token rotation prevents replay attacks

### 4. Input Validation
- TOTP codes must be exactly 6 digits
- Secrets are validated for proper format
- Email addresses are validated and normalized

## Testing

### Unit Tests
- `src/test/auth/service.test.ts`: AuthService TOTP methods
- `src/test/auth/routes.test.ts`: Authentication endpoints
- `src/test/middleware/totp.test.ts`: TOTP middleware

### Integration Tests
- `src/test/auth/totp-integration.test.ts`: Complete 2FA workflow
- `src/test/auth/integration.test.ts`: JWT integration with 2FA

### Demo Script
- `src/scripts/demo-2fa.ts`: Complete 2FA demonstration

## Configuration

### Environment Variables
```env
# TOTP Configuration
TOTP_ISSUER=TAU KAYS

# JWT Configuration (required for 2FA)
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

## Error Handling

### Common Error Codes
- `TOTP_REQUIRED`: 2FA must be enabled for Super Admin
- `TOTP_ENABLE_FAILED`: Failed to enable 2FA
- `TOTP_DISABLE_FAILED`: Failed to disable 2FA
- `TOTP_VALIDATION_ERROR`: TOTP middleware error
- `INVALID_TOTP_CODE`: Invalid TOTP code provided

### Error Response Format
```json
{
  "error": {
    "code": "TOTP_REQUIRED",
    "message": "Two-factor authentication must be enabled for Super Admin accounts",
    "requiresTOTP": true
  }
}
```

## Usage Examples

### Frontend Integration
```typescript
// Generate QR code for 2FA setup
const response = await fetch('/auth/totp/generate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
});

const { data } = await response.json();
// Display data.qrCodeDataUrl as an image
// Or show data.qrCodeUrl as text for manual entry
```

### Authenticator App Setup
1. User scans QR code with authenticator app (Google Authenticator, Authy, etc.)
2. App generates 6-digit TOTP codes every 30 seconds
3. User enters current TOTP code to enable 2FA
4. System validates code and enables 2FA for the account

## Compliance and Security

### TOTP Standards
- Follows RFC 6238 (TOTP) specification
- Uses SHA-1 hash algorithm (standard for TOTP)
- 30-second time step
- 6-digit codes

### Security Best Practices
- Secrets are stored encrypted in database
- QR codes are generated server-side to prevent client-side secret exposure
- Time window allows for reasonable clock drift
- Failed attempts are logged and rate-limited

## Future Enhancements

### Potential Improvements
1. **Backup Codes**: Generate one-time backup codes for account recovery
2. **Multiple Devices**: Support for multiple TOTP devices per user
3. **SMS Fallback**: SMS-based 2FA as backup option
4. **Hardware Tokens**: Support for FIDO2/WebAuthn hardware tokens
5. **Admin Override**: Emergency 2FA bypass for system administrators

### Monitoring and Analytics
1. **2FA Adoption Rates**: Track percentage of Super Admins with 2FA enabled
2. **Failed Attempt Analysis**: Monitor patterns in failed TOTP attempts
3. **Device Usage**: Track which authenticator apps are most commonly used

## Conclusion

The 2FA implementation provides robust security for Super Admin accounts while maintaining usability. The system enforces 2FA for all Super Admin logins, provides easy setup with QR codes, and includes comprehensive logging and monitoring capabilities.

The implementation follows industry best practices and standards, ensuring compatibility with popular authenticator applications and providing a secure foundation for the TAU KAYS system.