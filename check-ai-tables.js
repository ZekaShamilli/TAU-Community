const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

async function checkAITables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Check for AI-related tables
    console.log('🔍 Checking for AI-related tables...\n');
    const tablesQuery = `
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND (tablename ILIKE '%ai%' OR tablename ILIKE '%artificial%' OR tablename ILIKE '%ml%')
      ORDER BY tablename;
    `;
    
    const tablesResult = await client.query(tablesQuery);
    
    if (tablesResult.rows.length === 0) {
      console.log('✅ No AI-related tables found\n');
    } else {
      console.log(`Found ${tablesResult.rows.length} AI-related table(s):\n`);
      tablesResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.tablename}`);
      });
      console.log('');
    }

    // Check for AI-related functions
    console.log('🔍 Checking for AI-related functions...\n');
    const functionsQuery = `
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND (routine_name ILIKE '%ai%' OR routine_name ILIKE '%artificial%' OR routine_name ILIKE '%ml%')
      ORDER BY routine_name;
    `;
    
    const functionsResult = await client.query(functionsQuery);
    
    if (functionsResult.rows.length === 0) {
      console.log('✅ No AI-related functions found\n');
    } else {
      console.log(`Found ${functionsResult.rows.length} AI-related function(s):\n`);
      functionsResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.routine_name}`);
      });
      console.log('');
    }

    // Check for AI-related types
    console.log('🔍 Checking for AI-related types...\n');
    const typesQuery = `
      SELECT typname 
      FROM pg_type 
      WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        AND (typname ILIKE '%ai%' OR typname ILIKE '%artificial%' OR typname ILIKE '%ml%')
      ORDER BY typname;
    `;
    
    const typesResult = await client.query(typesQuery);
    
    if (typesResult.rows.length === 0) {
      console.log('✅ No AI-related types found\n');
    } else {
      console.log(`Found ${typesResult.rows.length} AI-related type(s):\n`);
      typesResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.typname}`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('✅ Connection closed');
  }
}

checkAITables();
