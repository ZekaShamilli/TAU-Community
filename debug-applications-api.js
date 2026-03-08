const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

async function debugApplicationsAPI() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Shukran's ID
    const shukranId = 'bd79f30b-7a1b-4bb6-b5d6-6bd9f3d552ea';
    
    // This is the exact query that the API uses for STUDENT role
    console.log('🔍 Running API query for Shukran (STUDENT view)...\n');
    const query = `
      SELECT 
        a.id, a.club_id, a.student_id, a.motivation, a.status,
        a.reviewed_by, a.reviewed_at, a.created_at, a.updated_at,
        u.first_name as student_first_name, u.last_name as student_last_name, 
        u.email as student_email,
        c.name as club_name,
        r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
      FROM applications a
      LEFT JOIN users u ON a.student_id = u.id
      LEFT JOIN clubs c ON a.club_id = c.id
      LEFT JOIN users r ON a.reviewed_by = r.id
      WHERE a.student_id = $1
      ORDER BY a.created_at DESC
    `;
    
    const result = await client.query(query, [shukranId]);
    
    console.log(`Found ${result.rows.length} application(s):\n`);
    
    if (result.rows.length === 0) {
      console.log('   No applications found - API should return empty array\n');
    } else {
      result.rows.forEach((row, index) => {
        console.log(`${index + 1}. Club: ${row.club_name}`);
        console.log(`   Status: ${row.status}`);
        console.log(`   Club ID: ${row.club_id}`);
        console.log(`   Application ID: ${row.id}`);
        console.log(`   Created: ${row.created_at}\n`);
      });
    }

    // Also check Demo club ID
    console.log('🔍 Demo club info:');
    const demoQuery = `SELECT id, name FROM clubs WHERE name = 'Demo'`;
    const demoResult = await client.query(demoQuery);
    if (demoResult.rows.length > 0) {
      console.log(`   ID: ${demoResult.rows[0].id}`);
      console.log(`   Name: ${demoResult.rows[0].name}\n`);
    }

    // Check if there are ANY applications for Demo club
    console.log('🔍 All applications for Demo club:');
    const demoAppsQuery = `
      SELECT a.id, a.status, u.email, u.first_name, u.last_name
      FROM applications a
      JOIN users u ON a.student_id = u.id
      WHERE a.club_id = $1
      ORDER BY a.created_at DESC
    `;
    const demoAppsResult = await client.query(demoAppsQuery, [demoResult.rows[0].id]);
    
    console.log(`   Found ${demoAppsResult.rows.length} application(s):\n`);
    demoAppsResult.rows.forEach((app, index) => {
      console.log(`   ${index + 1}. ${app.first_name} ${app.last_name} (${app.email})`);
      console.log(`      Status: ${app.status}`);
      console.log(`      ID: ${app.id}\n`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

debugApplicationsAPI();
