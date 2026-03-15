-- FORCE DROP: Finds and drops all versions of the function

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
