-- ============================================================================
-- DATABASE VERIFICATION SCRIPT
-- Run this first to check what already exists in your database
-- ============================================================================

-- Check which tables exist
SELECT
  'TABLE' as type,
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

-- Check table structures
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
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
ORDER BY table_name, ordinal_position;

-- Check existing data counts
SELECT 'restaurants' as table_name, COUNT(*) as row_count FROM restaurants
UNION ALL
SELECT 'menu_items', COUNT(*) FROM menu_items
UNION ALL
SELECT 'ingredients', COUNT(*) FROM ingredients
UNION ALL
SELECT 'cooking_steps', COUNT(*) FROM cooking_steps
UNION ALL
SELECT 'dietary_restrictions', COUNT(*) FROM dietary_restrictions
UNION ALL
SELECT 'customer_profiles', COUNT(*) FROM customer_profiles
UNION ALL
SELECT 'chef_requests', COUNT(*) FROM chef_requests;

-- Check RLS status
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'restaurants',
  'menu_items',
  'ingredients',
  'cooking_steps',
  'dietary_restrictions',
  'customer_profiles',
  'chef_requests'
)
ORDER BY tablename;

-- Check existing policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check existing indexes
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN (
  'restaurants',
  'menu_items',
  'ingredients',
  'cooking_steps',
  'dietary_restrictions',
  'customer_profiles',
  'chef_requests'
)
ORDER BY tablename, indexname;

-- Check existing functions
SELECT
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('update_updated_at', 'get_restaurant_by_qr')
ORDER BY routine_name;

-- Check existing triggers
SELECT
  trigger_schema,
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND event_object_table IN (
  'restaurants',
  'menu_items',
  'ingredients',
  'cooking_steps',
  'dietary_restrictions',
  'customer_profiles',
  'chef_requests'
)
ORDER BY event_object_table, trigger_name;

-- Check dietary restrictions data
SELECT
  name,
  allergens,
  description,
  created_at
FROM dietary_restrictions
ORDER BY name;
