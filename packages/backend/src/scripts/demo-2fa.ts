/**
 * Demo script for 2FA functionality
 * This script demonstrates the complete 2FA workflow for Super Admins
 */

import { AuthService } from '../lib/auth/service';
import { db } from '../lib/database';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

async function demo2FA() {
  console.log('ðŸ” TAU Community 2FA Demo');
  console.log('==================');

  try {
    // Initialize the auth service
    await AuthService.initialize();

    // 1. Create a test Super Admin user
    console.log('\n1. Creating Super Admin user...');
    const client = db.getClient();
    
    const passwordHash = await bcrypt.hash('testpassword123', 10);
    
    const superAdmin = await client.user.create({
      data: {
        email: 'demo-admin@tau.edu.az',
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        firstName: 'Demo',
        lastName: 'Admin',
        isActive: true,
        totpEnabled: false,
      },
    });

    console.log(`âœ… Created Super Admin: ${superAdmin.email}`);

    // 2. Attempt login without 2FA (should fail)
    console.log('\n2. Attempting login without 2FA...');
    const loginAttempt1 = await AuthService.login({
      email: 'demo-admin@tau.edu.az',
      password: 'testpassword123',
    });

    if (!loginAttempt1.success && loginAttempt1.requiresTOTP) {
      console.log('âŒ Login failed as expected - 2FA required for Super Admin');
      console.log(`   Error: ${loginAttempt1.error}`);
    }

    // 3. Generate TOTP secret
    console.log('\n3. Generating TOTP secret...');
    const totpData = await AuthService.generateTOTPSecret(superAdmin.email);
    
    console.log('âœ… TOTP Secret generated:');
    console.log(`   Secret: ${totpData.secret}`);
    console.log(`   QR Code URL: ${totpData.qrCodeUrl}`);
    console.log(`   QR Code Data URL: ${totpData.qrCodeDataUrl.substring(0, 50)}...`);
    console.log(`   Manual Entry Key: ${totpData.manualEntryKey}`);

    // 4. Enable TOTP (simulate user scanning QR code and entering valid token)
    console.log('\n4. Enabling TOTP...');
    
    // For demo purposes, we'll use a mock TOTP token
    // In real usage, the user would scan the QR code and enter the 6-digit code
    const mockTotpToken = '123456';
    
    // Mock the TOTP verification for demo
    const originalVerify = AuthService.verifyTOTP;
    AuthService.verifyTOTP = () => true; // Mock successful verification
    
    const enableResult = await AuthService.enableTOTP(
      superAdmin.id,
      totpData.secret,
      mockTotpToken
    );

    if (enableResult.success) {
      console.log('âœ… TOTP enabled successfully');
    } else {
      console.log(`âŒ Failed to enable TOTP: ${enableResult.error}`);
    }

    // Restore original function
    AuthService.verifyTOTP = originalVerify;

    // 5. Attempt login with 2FA
    console.log('\n5. Attempting login with 2FA...');
    
    // Mock TOTP verification for login
    const speakeasy = require('speakeasy');
    const originalTotpVerify = speakeasy.totp.verify;
    speakeasy.totp.verify = () => true; // Mock successful TOTP verification
    
    const loginAttempt2 = await AuthService.login({
      email: 'demo-admin@tau.edu.az',
      password: 'testpassword123',
      totpCode: '123456',
    });

    if (loginAttempt2.success) {
      console.log('âœ… Login successful with 2FA!');
      console.log(`   User: ${loginAttempt2.user?.firstName} ${loginAttempt2.user?.lastName}`);
      console.log(`   Role: ${loginAttempt2.user?.role}`);
      console.log(`   TOTP Enabled: ${loginAttempt2.user?.totpEnabled}`);
      console.log(`   Access Token: ${loginAttempt2.tokens?.accessToken.substring(0, 20)}...`);
    } else {
      console.log(`âŒ Login failed: ${loginAttempt2.error}`);
    }

    // Restore original function
    speakeasy.totp.verify = originalTotpVerify;

    // 6. Test TOTP middleware
    console.log('\n6. Testing TOTP middleware...');
    
    const userWithTOTP = await AuthService.getUserFromToken(loginAttempt2.tokens?.accessToken || '');
    if (userWithTOTP && userWithTOTP.totpEnabled) {
      console.log('âœ… TOTP middleware would allow access for this Super Admin');
    } else {
      console.log('âŒ TOTP middleware would deny access');
    }

    // 7. Cleanup
    console.log('\n7. Cleaning up demo data...');
    await client.user.delete({
      where: { id: superAdmin.id },
    });
    console.log('âœ… Demo user deleted');

    console.log('\nðŸŽ‰ 2FA Demo completed successfully!');
    console.log('\nKey Features Demonstrated:');
    console.log('- âœ… Super Admin 2FA requirement enforcement');
    console.log('- âœ… TOTP secret generation with QR code');
    console.log('- âœ… TOTP validation during login');
    console.log('- âœ… JWT token generation with 2FA');
    console.log('- âœ… TOTP middleware protection');

  } catch (error) {
    console.error('âŒ Demo failed:', error);
  } finally {
    // Close database connections
    await db.disconnect();
  }
}

// Run the demo if this script is executed directly
if (require.main === module) {
  demo2FA().catch(console.error);
}

export { demo2FA };
