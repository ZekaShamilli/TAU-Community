const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

async function checkShukranApplications() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Find Shukran Alizade
    console.log('🔍 Finding Shukran Alizade...');
    const userQuery = `
      SELECT id, email, first_name, last_name, role 
      FROM users 
      WHERE first_name ILIKE '%shukran%' OR last_name ILIKE '%alizade%' OR last_name ILIKE '%alizada%'
    `;
    const userResult = await client.query(userQuery);
    
    if (userResult.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }

    const user = userResult.rows[0];
    console.log(`✅ Found user: ${user.first_name} ${user.last_name} (${user.email})`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Role: ${user.role}\n`);

    // Check applications
    console.log('🔍 Checking applications...');
    const appQuery = `
      SELECT 
        a.id, a.status, a.created_at,
        c.id as club_id, c.name as club_name
      FROM applications a
      JOIN clubs c ON a.club_id = c.id
      WHERE a.student_id = $1
      ORDER BY a.created_at DESC
    `;
    const appResult = await client.query(appQuery, [user.id]);
    
    if (appResult.rows.length === 0) {
      console.log('   No applications found\n');
    } else {
      console.log(`   Found ${appResult.rows.length} application(s):\n`);
      appResult.rows.forEach((app, index) => {
        console.log(`   ${index + 1}. ${app.club_name}`);
        console.log(`      Status: ${app.status}`);
        console.log(`      Application ID: ${app.id}`);
        console.log(`      Club ID: ${app.club_id}`);
        console.log(`      Created: ${app.created_at}\n`);
      });
    }

    // Check Demo club specifically
    console.log('🔍 Checking Demo club...');
    const demoQuery = `
      SELECT id, name, president_id
      FROM clubs
      WHERE name ILIKE '%demo%'
    `;
    const demoResult = await client.query(demoQuery);
    
    if (demoResult.rows.length > 0) {
      console.log(`   Found ${demoResult.rows.length} Demo club(s):\n`);
      for (const club of demoResult.rows) {
        console.log(`   Club: ${club.name}`);
        console.log(`   Club ID: ${club.id}`);
        console.log(`   President ID: ${club.president_id}\n`);
        
        // Check if Shukran is president
        if (club.president_id === user.id) {
          console.log(`   ⚠️ Shukran IS the president of ${club.name}!\n`);
        }
        
        // Check applications for this club
        const clubAppQuery = `
          SELECT id, status, student_id
          FROM applications
          WHERE club_id = $1 AND student_id = $2
        `;
        const clubAppResult = await client.query(clubAppQuery, [club.id, user.id]);
        
        if (clubAppResult.rows.length > 0) {
          console.log(`   Applications for ${club.name}:`);
          clubAppResult.rows.forEach(app => {
            console.log(`      - Status: ${app.status}, ID: ${app.id}`);
          });
          console.log('');
        } else {
          console.log(`   No applications for ${club.name}\n`);
        }
      }
    } else {
      console.log('   No Demo club found\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('✅ Connection closed');
  }
}

checkShukranApplications();
