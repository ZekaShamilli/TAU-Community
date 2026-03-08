const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

async function showSuperAdmin() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    const query = `
      SELECT id, email, first_name, last_name, role, is_active, created_at
      FROM users
      WHERE role = 'SUPER_ADMIN'
      ORDER BY created_at ASC
    `;
    
    const result = await client.query(query);
    
    if (result.rows.length === 0) {
      console.log('❌ No super admin found!\n');
    } else {
      console.log(`Found ${result.rows.length} super admin(s):\n`);
      result.rows.forEach((admin, index) => {
        console.log(`${index + 1}. ${admin.first_name} ${admin.last_name}`);
        console.log(`   Email: ${admin.email}`);
        console.log(`   ID: ${admin.id}`);
        console.log(`   Active: ${admin.is_active}`);
        console.log(`   Created: ${admin.created_at}\n`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('✅ Connection closed');
  }
}

showSuperAdmin();
