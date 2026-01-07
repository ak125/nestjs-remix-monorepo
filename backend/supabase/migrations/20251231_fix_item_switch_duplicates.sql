-- Migration: Fix Item Switch Duplicates
-- Date: 2025-12-31
-- Issue: Same content was duplicated across alias 1 and alias 2
-- Solution: Keep alias 1 records, delete duplicate alias 2 records

-- Step 1: Identify duplicates (same content exists in both alias 1 and 2)
-- This is for verification only
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM __seo_item_switch a
    INNER JOIN __seo_item_switch b
        ON a.sis_content = b.sis_content
        AND a.sis_pg_id = b.sis_pg_id
        AND a.sis_alias = '1'
        AND b.sis_alias = '2';

    RAISE NOTICE '🔍 Found % duplicate content pairs (alias 1+2)', duplicate_count;
END $$;

-- Step 2: Delete alias 2 records that have the same content as alias 1 for the same pg_id
DELETE FROM __seo_item_switch
WHERE sis_id IN (
    SELECT b.sis_id
    FROM __seo_item_switch a
    INNER JOIN __seo_item_switch b
        ON a.sis_content = b.sis_content
        AND a.sis_pg_id = b.sis_pg_id
        AND a.sis_alias = '1'
        AND b.sis_alias = '2'
);

-- Step 3: Verify the fix - count records per alias
DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE '📊 After fix - Records per alias:';
    FOR r IN
        SELECT sis_alias, COUNT(*) as count
        FROM __seo_item_switch
        GROUP BY sis_alias
        ORDER BY sis_alias
    LOOP
        RAISE NOTICE '   Alias %: % records', r.sis_alias, r.count;
    END LOOP;
END $$;

-- Step 4: Verify no more duplicates exist
DO $$
DECLARE
    remaining_duplicates INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_duplicates
    FROM __seo_item_switch a
    INNER JOIN __seo_item_switch b
        ON a.sis_content = b.sis_content
        AND a.sis_pg_id = b.sis_pg_id
        AND a.sis_alias = '1'
        AND b.sis_alias = '2';

    IF remaining_duplicates = 0 THEN
        RAISE NOTICE '✅ SUCCESS: No more duplicates between alias 1 and 2';
    ELSE
        RAISE WARNING '⚠️ WARNING: Still % duplicates remaining', remaining_duplicates;
    END IF;
END $$;
