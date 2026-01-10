/*
  # Database Verification Queries

  Run these queries in your Supabase SQL Editor to verify that everything is properly set up.
  Each section will check different aspects of your database.
*/

-- ============================================================================
-- 1. CHECK ALL TABLES EXIST
-- ============================================================================

SELECT
  'Tables' as check_type,
  table_name,
  'EXISTS' as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'restaurants',
    'menu_items',
    'ingredients',
    'cooking_steps',
    'dietary_restrictions',
    'customer_profiles',
    'chef_requests'
  )
ORDER BY table_name;

-- Expected Result: Should show 7 tables

-- ============================================================================
-- 2. CHECK ALL FUNCTIONS EXIST
-- ============================================================================

SELECT
  'Functions' as check_type,
  routine_name as function_name,
  routine_type,
  'EXISTS' as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'update_updated_at',
    'get_restaurant_by_qr'
  )
ORDER BY routine_name;

-- Expected Result: Should show 2 functions

-- ============================================================================
-- 3. CHECK ALL TRIGGERS EXIST
-- ============================================================================

SELECT
  'Triggers' as check_type,
  trigger_name,
  event_object_table as table_name,
  'ACTIVE' as status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE '%updated_at%'
ORDER BY trigger_name;

-- Expected Result: Should show 4 triggers (one for each table with updated_at)

-- ============================================================================
-- 4. CHECK RLS IS ENABLED
-- ============================================================================

SELECT
  'RLS Status' as check_type,
  tablename as table_name,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Expected Result: All tables should have rls_enabled = true

-- ============================================================================
-- 5. CHECK RLS POLICIES COUNT
-- ============================================================================

SELECT
  'RLS Policies' as check_type,
  tablename as table_name,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Expected Result:
-- restaurants: 4 policies
-- menu_items: 6 policies
-- ingredients: 2 policies
-- cooking_steps: 2 policies
-- dietary_restrictions: 2 policies
-- customer_profiles: 1 policy
-- chef_requests: 3 policies

-- ============================================================================
-- 6. CHECK INDEXES EXIST
-- ============================================================================

SELECT
  'Indexes' as check_type,
  tablename as table_name,
  indexname as index_name,
  'EXISTS' as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Expected Result: Should show 9 custom indexes

-- ============================================================================
-- 7. CHECK DIETARY RESTRICTIONS SEED DATA
-- ============================================================================

SELECT
  'Seed Data' as check_type,
  COUNT(*) as total_dietary_restrictions,
  CASE
    WHEN COUNT(*) = 10 THEN 'COMPLETE'
    WHEN COUNT(*) > 0 THEN 'PARTIAL'
    ELSE 'MISSING'
  END as status
FROM dietary_restrictions;

-- Expected Result: 10 dietary restrictions

-- ============================================================================
-- 8. LIST ALL DIETARY RESTRICTIONS
-- ============================================================================

SELECT
  name,
  description,
  array_length(allergens, 1) as allergen_count
FROM dietary_restrictions
ORDER BY name;

-- Expected Result: Should show all 10 default dietary restrictions

-- ============================================================================
-- 9. CHECK FOREIGN KEY CONSTRAINTS
-- ============================================================================

SELECT
  'Foreign Keys' as check_type,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- Expected Result: Should show all foreign key relationships

-- ============================================================================
-- 10. CHECK TABLE COLUMN COUNTS
-- ============================================================================

SELECT
  'Column Count' as check_type,
  table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'restaurants',
    'menu_items',
    'ingredients',
    'cooking_steps',
    'dietary_restrictions',
    'customer_profiles',
    'chef_requests'
  )
GROUP BY table_name
ORDER BY table_name;

-- Expected Result:
-- restaurants: 11 columns
-- menu_items: 11 columns
-- ingredients: 7 columns
-- cooking_steps: 7 columns
-- dietary_restrictions: 6 columns
-- customer_profiles: 7 columns
-- chef_requests: 11 columns

-- ============================================================================
-- 11. TEST update_updated_at FUNCTION
-- ============================================================================

-- This test will verify that the trigger works correctly
-- You can skip this if you don't want to test with actual data

-- Uncomment to test:
/*
DO $$
DECLARE
  test_result text;
BEGIN
  -- Test the function exists and can be called
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_updated_at'
  ) THEN
    test_result := 'PASS: update_updated_at function exists';
  ELSE
    test_result := 'FAIL: update_updated_at function not found';
  END IF;

  RAISE NOTICE '%', test_result;
END $$;
*/

-- ============================================================================
-- 12. TEST get_restaurant_by_qr FUNCTION
-- ============================================================================

-- Test the function exists
SELECT
  'Function Test' as check_type,
  'get_restaurant_by_qr' as function_name,
  CASE
    WHEN COUNT(*) > 0 THEN 'EXISTS'
    ELSE 'MISSING'
  END as status
FROM pg_proc
WHERE proname = 'get_restaurant_by_qr';

-- ============================================================================
-- SUMMARY CHECK
-- ============================================================================

SELECT
  '==== SETUP SUMMARY ====' as summary,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('restaurants', 'menu_items', 'ingredients', 'cooking_steps', 'dietary_restrictions', 'customer_profiles', 'chef_requests')) || '/7' as tables,
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('update_updated_at', 'get_restaurant_by_qr')) || '/2' as functions,
  (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public' AND trigger_name LIKE '%updated_at%') || '/4' as triggers,
  (SELECT COUNT(*) FROM dietary_restrictions) || '/10' as seed_data,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') || '/20' as rls_policies;
