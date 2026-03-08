const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

async function findShukranClub() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Find Shukran
    const userQuery = `
      SELECT id, email, first_name, last_name, role 
      FROM users 
      WHERE email = 'alizade.shukran11@gmail.com'
    `;
    const userResult = await client.query(userQuery);
    const user = userResult.rows[0];
    
    console.log(`User: ${user.first_name} ${user.last_name}`);
    console.log(`ID: ${user.id}`);
    console.log(`Role: ${user.role}\n`);

    // Find club where Shukran is president
    console.log('🔍 Finding club where Shukran is president...');
    const clubQuery = `
      SELECT id, name, description, is_active, president_id
      FROM clubs
      WHERE president_id = $1
    `;
    const clubResult = await client.query(clubQuery, [user.id]);
    
    if (clubResult.rows.length === 0) {
      console.log('❌ No club found where Shukran is president\n');
    } else {
      console.log(`✅ Found ${clubResult.rows.length} club(s):\n`);
      clubResult.rows.forEach((club, index) => {
        console.log(`${index + 1}. ${club.name}`);
        console.log(`   ID: ${club.id}`);
        console.log(`   Active: ${club.is_active}`);
        console.log(`   Description: ${club.description}\n`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

findShukranClub();
