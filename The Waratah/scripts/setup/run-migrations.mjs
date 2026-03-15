import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🚀 Checking database status...\n');

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkFunctionExists() {
  try {
    // Try to call the function with dummy data
    const { error } = await supabase.rpc('search_with_analytics', {
      p_query_text: 'test',
      p_query_embedding: Array(1536).fill(0),
      p_match_count: 1,
      p_match_threshold: 0.5,
      p_search_type: 'vector',
      p_category_filter: null
    });

    if (error) {
      if (error.message.includes('Could not find the function')) {
        console.log('❌ Function search_with_analytics does NOT exist');
        console.log('📋 Migrations need to be applied manually\n');
        return false;
      }
      // Other errors might be ok (like no data)
      console.log('✅ Function search_with_analytics EXISTS');
      return true;
    }

    console.log('✅ Function search_with_analytics EXISTS');
    return true;
  } catch (err) {
    console.log('❌ Error checking function:', err.message);
    return false;
  }
}

async function checkTables() {
  try {
    const { data, error } = await supabase
      .from('rag_chunks')
      .select('id', { count: 'exact', head: true });

    if (error) {
      console.log('❌ Table rag_chunks error:', error.message);
      return false;
    }

    console.log(`✅ Table rag_chunks exists`);
    return true;
  } catch (err) {
    console.log('❌ Error checking tables:', err.message);
    return false;
  }
}

async function main() {
  const tablesExist = await checkTables();
  const functionExists = await checkFunctionExists();

  if (!functionExists) {
    console.log('\n📝 TO APPLY MIGRATIONS:');
    console.log('1. Go to: https://supabase.com/dashboard/project/jtacdnkqvypriosgheih/sql/new');
    console.log('2. Copy and paste each migration file in order:');
    console.log('   - supabase/migrations/001_match_documents.sql');
    console.log('   - supabase/migrations/002_optimize_search.sql');
    console.log('   - supabase/migrations/003_memory_tables.sql');
    console.log('   - supabase/migrations/004_reasoning_bank.sql');
    console.log('3. Run each one by clicking "Run"');
    console.log('\n💡 Or, give me permission to read the migration files and I will display them for you to copy-paste.');
  } else {
    console.log('\n✅ Database is ready! You can now search for "sake"');
  }
}

main();
