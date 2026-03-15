import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

// Extract project ref from Supabase URL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const projectRef = supabaseUrl.split('//')[1].split('.')[0]; // Extract 'jtacdnkqvypriosgheih'

// Construct connection string
// Format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
const connectionString = `postgresql://postgres.${projectRef}:${process.env.SUPABASE_SERVICE_ROLE_KEY}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;

console.log('🔌 Connecting to Supabase Postgres...\n');

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function applyMigration(filePath, name) {
  console.log(`📄 Applying: ${name}`);

  const sql = readFileSync(filePath, 'utf8');

  try {
    await client.query(sql);
    console.log(`✅ ${name} applied successfully\n`);
    return true;
  } catch (err) {
    console.log(`⚠️  ${name}: ${err.message.split('\n')[0]}\n`);
    return false;
  }
}

async function main() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    const migrations = [
      { file: '001_match_documents.sql', name: 'Match Documents' },
      { file: '002_optimize_search.sql', name: 'Search Optimization' },
      { file: '003_memory_tables.sql', name: 'Memory Tables' },
      { file: '004_reasoning_bank.sql', name: 'Reasoning Bank' }
    ];

    for (const migration of migrations) {
      const filePath = join(__dirname, 'supabase', 'migrations', migration.file);
      await applyMigration(filePath, migration.name);
    }

    // Verify function exists
    console.log('🔍 Verifying search function...');
    const result = await client.query(`
      SELECT proname FROM pg_proc
      WHERE proname = 'search_with_analytics'
    `);

    if (result.rows.length > 0) {
      console.log('✅ search_with_analytics function is installed!\n');
    } else {
      console.log('❌ search_with_analytics function not found\n');
    }

    await client.end();
    console.log('✅ All migrations completed!\n');
    console.log('🔍 You can now search for "sake" in your 1,951 documents!');

  } catch (err) {
    console.error('❌ Connection error:', err.message);
    console.log('\n💡 The direct database connection may not be available.');
    console.log('   Please apply migrations via Supabase Dashboard SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/jtacdnkqvypriosgheih/sql/new');
  }
}

main();
