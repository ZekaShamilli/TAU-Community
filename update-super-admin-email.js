const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

async function updateSuperAdminEmail() {
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
      SELECT id, email, first_name, last_name, role, created_at
      FROM users
      WHERE role = 'SUPER_ADMIN'
      ORDER BY created_at ASC
    `;
    
    const result = await client.query(findQuery);
    
    if (result.rows.length === 0) {
      console.log('❌ No super admin found!\n');
      return;
    }

    console.log(`Found ${result.rows.length} super admin(s):\n`);
    result.rows.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.first_name} ${admin.last_name}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   ID: ${admin.id}`);
      console.log(`   Created: ${admin.created_at}\n`);
    });

    // Get new email from user
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question('Enter the NEW email address for super admin: ', async (newEmail) => {
      if (!newEmail || !newEmail.includes('@')) {
        console.log('\n❌ Invalid email address!');
        readline.close();
        await client.end();
        return;
      }

      // Check if email already exists
      const checkQuery = `SELECT id FROM users WHERE email = $1`;
      const checkResult = await client.query(checkQuery, [newEmail]);
      
      if (checkResult.rows.length > 0) {
        console.log('\n❌ This email is already in use by another user!');
        readline.close();
        await client.end();
        return;
      }

      // Update the first super admin's email
      const adminId = result.rows[0].id;
      const updateQuery = `
        UPDATE users 
        SET email = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, email, first_name, last_name
      `;
      
      try {
        const updateResult = await client.query(updateQuery, [newEmail, adminId]);
        const updated = updateResult.rows[0];
        
        console.log('\n✅ Super admin email updated successfully!\n');
        console.log(`   Name: ${updated.first_name} ${updated.last_name}`);
        console.log(`   Old Email: ${result.rows[0].email}`);
        console.log(`   New Email: ${updated.email}`);
        console.log(`   ID: ${updated.id}\n`);
      } catch (error) {
        console.log('\n❌ Failed to update email:', error.message);
      }

      readline.close();
      await client.end();
      console.log('✅ Connection closed');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.end();
  }
}

updateSuperAdminEmail();
