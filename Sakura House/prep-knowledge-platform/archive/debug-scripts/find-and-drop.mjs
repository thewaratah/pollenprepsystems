import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Finding and dropping search_with_analytics function...\n');

async function findAndDrop() {
  try {
    // Query to find the exact function signature
    const { data, error } = await supabase.rpc('exec', {
      sql: `
        SELECT
          p.proname as function_name,
          pg_get_function_identity_arguments(p.oid) as arguments
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'search_with_analytics'
          AND n.nspname = 'public';
      `
    });

    if (error) {
      console.log('❌ Could not query functions:', error.message);
      console.log('\n💡 Try running this SQL directly in Supabase:');
      console.log('```sql');
      console.log(`DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT
            p.oid::regprocedure as func_signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'search_with_analytics'
          AND n.nspname = 'public'
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.func_signature || ' CASCADE';
        RAISE NOTICE 'Dropped: %', r.func_signature;
    END LOOP;
END $$;`);
      console.log('```');
    } else {
      console.log('✅ Found functions:', data);
    }

  } catch (err) {
    console.log('❌ Error:', err.message);
    console.log('\n💡 ALTERNATIVE: Run this in Supabase SQL Editor:\n');
    console.log('```sql');
    console.log(`-- Drop all versions of the function
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT
            p.oid::regprocedure as func_signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'search_with_analytics'
          AND n.nspname = 'public'
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.func_signature || ' CASCADE';
        RAISE NOTICE 'Dropped: %', r.func_signature;
    END LOOP;
END $$;
`);
    console.log('```');
    console.log('\nThen run step2-CREATE.sql\n');
  }
}

findAndDrop();
