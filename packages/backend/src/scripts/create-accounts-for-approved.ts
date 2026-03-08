/**
 * Script to create user accounts for existing approved applications
 * This handles applications that were approved before the auto-account creation feature
 */

import { db } from '../lib/db';

async function createAccountsForApprovedApplications() {
  console.log('🚀 Starting account creation for approved applications...');
  
  try {
    // Get all approved applications that don't have user accounts yet
    const approvedApplications = await db.query(`
      SELECT DISTINCT
        a.student_name,
        a.student_email,
        a.reviewed_at
      FROM applications a
      LEFT JOIN users u ON a.student_email = u.email
      WHERE a.status = 'APPROVED' 
        AND u.id IS NULL
      ORDER BY a.reviewed_at ASC
    `);

    console.log(`📋 Found ${approvedApplications.rows.length} approved applications without user accounts`);

    if (approvedApplications.rows.length === 0) {
      console.log('✅ All approved applications already have user accounts!');
      return;
    }

    let createdCount = 0;
    const defaultPasswordHash = '$2b$10$rQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQYQZ8kHWKQ';

    for (const app of approvedApplications.rows) {
      try {
        const studentEmail = app.student_email;
        const studentName = app.student_name;
        
        // Parse name into first and last name
        const nameParts = studentName.split(' ');
        const firstName = nameParts[0] || 'Student';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        // Create user account
        await db.query(`
          INSERT INTO users (email, password_hash, role, first_name, last_name, is_active, created_at)
          VALUES ($1, $2, 'STUDENT', $3, $4, true, $5)
        `, [studentEmail, defaultPasswordHash, firstName, lastName, app.reviewed_at]);
        
        console.log(`✅ Created account for: ${firstName} ${lastName} (${studentEmail})`);
        createdCount++;
        
      } catch (error: any) {
        if (error.code === '23505') { // Unique constraint violation
          console.log(`⚠️  Account already exists for: ${app.student_email}`);
        } else {
          console.error(`❌ Error creating account for ${app.student_email}:`, error.message);
        }
      }
    }

    console.log(`\n🎉 Successfully created ${createdCount} user accounts!`);
    console.log('📊 Summary:');
    console.log(`   - Total approved applications: ${approvedApplications.rows.length}`);
    console.log(`   - Accounts created: ${createdCount}`);
    console.log(`   - Already existed: ${approvedApplications.rows.length - createdCount}`);

  } catch (error: any) {
    console.error('❌ Error in account creation script:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  createAccountsForApprovedApplications()
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { createAccountsForApprovedApplications };