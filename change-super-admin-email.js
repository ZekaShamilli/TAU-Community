const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

// Usage: node change-super-admin-email.js new-email@example.com

async function changeSuperAdminEmail() {
  const newEmail = process.argv[2];

  if (!newEmail) {
    console.log('❌ Please provide new email address!');
    console.log('Usage: node change-super-admin-email.js new-email@example.com');
    return;
  }

  if (!newEmail.includes('@')) {
    console.log('❌ Invalid email address!');
    return;
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Find current super admin
    console.log('🔍 Finding current super admin...\n');
    const findQuery = `
      SELECT id, email, first_name, last_name, role
      FROM users
      WHERE role = 'SUPER_ADMIN'
      ORDER BY created_at ASC
      LIMIT 1
    `;
    
    const result = await client.query(findQuery);
    
    if (result.rows.length === 0) {
      console.log('❌ No super admin found!\n');
      return;
    }

    const admin = result.rows[0];
    console.log(`Current super admin: ${admin.first_name} ${admin.last_name}`);
    console.log(`Current email: ${admin.email}`);
    console.log(`ID: ${admin.id}\n`);

    // Check if new email already exists
    const checkQuery = `SELECT id, email FROM users WHERE email = $1`;
    const checkResult = await client.query(checkQuery, [newEmail]);
    
    if (checkResult.rows.length > 0) {
      console.log(`❌ Email "${newEmail}" is already in use by another user!`);
      console.log(`   User ID: ${checkResult.rows[0].id}\n`);
      return;
    }

    // Update email
    console.log(`🔄 Updating email to: ${newEmail}...\n`);
    const updateQuery = `
      UPDATE users 
      SET email = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, email, first_name, last_name
    `;
    
    const updateResult = await client.query(updateQuery, [newEmail, admin.id]);
    const updated = updateResult.rows[0];
    
    console.log('✅ Super admin email updated successfully!\n');
    console.log(`   Name: ${updated.first_name} ${updated.last_name}`);
    console.log(`   Old Email: ${admin.email}`);
    console.log(`   New Email: ${updated.email}`);
    console.log(`   ID: ${updated.id}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('✅ Connection closed');
  }
}

changeSuperAdminEmail();
