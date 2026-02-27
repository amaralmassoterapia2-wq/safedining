-- ============================================================================
-- MIGRATION: Merge duplicate dietary restrictions
-- Fish Allergy + Fish-Free → Fish Allergy
-- Nut Allergy + Nut-Free → Nut Allergy
-- Shellfish Allergy + Shellfish-Free → Shellfish Allergy
-- ============================================================================

-- 1. Update Fish Allergy allergens (merge in "anchovy" from Fish-Free)
UPDATE dietary_restrictions
SET allergens = ARRAY['fish', 'salmon', 'tuna', 'cod', 'halibut', 'anchovy']
WHERE name = 'Fish Allergy';

-- 2. Update Nut Allergy allergens (merge in "tree nuts" from Nut-Free)
UPDATE dietary_restrictions
SET allergens = ARRAY['peanuts', 'almonds', 'walnuts', 'cashews', 'pecans', 'pistachios', 'nuts', 'nut', 'tree nuts']
WHERE name = 'Nut Allergy';

-- 3. Update Shellfish Allergy allergens (add plural forms from Shellfish-Free)
UPDATE dietary_restrictions
SET allergens = ARRAY['shrimp', 'crab', 'lobster', 'crayfish', 'prawn', 'clam', 'clams', 'mussel', 'mussels', 'oyster', 'oysters', 'scallop', 'squid', 'calamari', 'octopus', 'shellfish', 'seafood', 'mollusks']
WHERE name = 'Shellfish Allergy';

-- 4. Update customer_profiles: replace "Fish-Free" with "Fish Allergy"
UPDATE customer_profiles
SET dietary_restrictions = array_replace(dietary_restrictions, 'Fish-Free', 'Fish Allergy')
WHERE 'Fish-Free' = ANY(dietary_restrictions);

-- 5. Update customer_profiles: replace "Nut-Free" with "Nut Allergy"
UPDATE customer_profiles
SET dietary_restrictions = array_replace(dietary_restrictions, 'Nut-Free', 'Nut Allergy')
WHERE 'Nut-Free' = ANY(dietary_restrictions);

-- 6. Update customer_profiles: replace "Shellfish-Free" with "Shellfish Allergy"
UPDATE customer_profiles
SET dietary_restrictions = array_replace(dietary_restrictions, 'Shellfish-Free', 'Shellfish Allergy')
WHERE 'Shellfish-Free' = ANY(dietary_restrictions);

-- 7. Remove duplicate rows
DELETE FROM dietary_restrictions WHERE name = 'Fish-Free';
DELETE FROM dietary_restrictions WHERE name = 'Nut-Free';
DELETE FROM dietary_restrictions WHERE name = 'Shellfish-Free';
