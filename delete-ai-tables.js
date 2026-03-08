const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

async function deleteAITables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    console.log('🗑️  Deleting AI tables...\n');

    // Drop AI tables
    const tables = ['ai_alerts', 'ai_interaction_logs', 'ai_rate_limits'];
    
    for (const table of tables) {
      try {
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`   ✓ Dropped table: ${table}`);
      } catch (error) {
        console.log(`   ✗ Failed to drop table ${table}: ${error.message}`);
      }
    }

    console.log('\n🗑️  Deleting AI types...\n');

    // Drop AI types
    const types = [
      'ai_alerts',
      'ai_daily_cost_summary',
      'ai_feature_usage_summary',
      'ai_interaction_logs',
      'ai_rate_limit_summary',
      'ai_rate_limits'
    ];
    
    for (const type of types) {
      try {
        await client.query(`DROP TYPE IF EXISTS ${type} CASCADE`);
        console.log(`   ✓ Dropped type: ${type}`);
      } catch (error) {
        console.log(`   ✗ Failed to drop type ${type}: ${error.message}`);
      }
    }

    // Verify deletion
    console.log('\n🔍 Verifying deletion...\n');
    
    const remainingTables = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND (tablename ILIKE '%ai%')
    `);
    
    if (remainingTables.rows.length === 0) {
      console.log('   ✅ All AI tables deleted successfully!');
    } else {
      console.log(`   ⚠️  ${remainingTables.rows.length} AI table(s) still remain:`);
      remainingTables.rows.forEach(row => {
        console.log(`      - ${row.tablename}`);
      });
    }

    const remainingTypes = await client.query(`
      SELECT typname 
      FROM pg_type 
      WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        AND (typname ILIKE '%ai%')
    `);
    
    if (remainingTypes.rows.length === 0) {
      console.log('   ✅ All AI types deleted successfully!\n');
    } else {
      console.log(`   ⚠️  ${remainingTypes.rows.length} AI type(s) still remain:`);
      remainingTypes.rows.forEach(row => {
        console.log(`      - ${row.typname}`);
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

deleteAITables();
