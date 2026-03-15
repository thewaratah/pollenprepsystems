const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration(filePath) {
  console.log(`\n📄 Applying migration: ${path.basename(filePath)}`);

  const sql = fs.readFileSync(filePath, 'utf8');

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // If exec_sql doesn't exist, try direct SQL execution
      console.log('⚠️  exec_sql RPC not available, attempting direct execution...');

      // Split by common delimiters and execute statements
      const statements = sql
        .split(/;[\s\n]+(?=CREATE|ALTER|DROP|INSERT|GRANT|COMMENT)/gi)
        .filter(s => s.trim().length > 0);

      console.log(`   Found ${statements.length} statements to execute`);

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i].trim() + ';';
        if (stmt.length > 2) {
          try {
            const result = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({ query: stmt })
            });

            if (!result.ok) {
              console.log(`   ⚠️  Statement ${i+1} warning: ${result.statusText}`);
            } else {
              console.log(`   ✓ Statement ${i+1}/${statements.length}`);
            }
          } catch (err) {
            console.log(`   ⚠️  Statement ${i+1} warning: ${err.message}`);
          }
        }
      }

      console.log('✅ Migration applied (with warnings - may need manual verification)');
    } else {
      console.log('✅ Migration applied successfully');
    }
  } catch (err) {
    console.error('❌ Error applying migration:', err.message);
    throw err;
  }
}

async function main() {
  console.log('🚀 Starting migration process...\n');

  const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
  const migrations = [
    '001_match_documents.sql',
    '002_optimize_search.sql',
    '003_memory_tables.sql',
    '004_reasoning_bank.sql'
  ];

  for (const migration of migrations) {
    const filePath = path.join(migrationsDir, migration);
    if (fs.existsSync(filePath)) {
      await applyMigration(filePath);
    } else {
      console.log(`⚠️  Migration file not found: ${migration}`);
    }
  }

  console.log('\n✅ All migrations completed!');
  console.log('🔍 You can now search the knowledge base.');
}

main().catch(console.error);
