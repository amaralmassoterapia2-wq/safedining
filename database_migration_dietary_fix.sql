-- ============================================================================
-- LIVE DATABASE FIX: Dietary Restrictions Update
-- Run this against the live Supabase database to fix:
-- 1. Shellfish Allergy missing mollusc keywords (calamari, squid, etc.)
-- 2. Add Kosher dietary restriction
-- 3. Add Halal dietary restriction
-- ============================================================================

-- Update Shellfish Allergy to include molluscs
UPDATE dietary_restrictions
SET allergens = ARRAY['shrimp', 'crab', 'lobster', 'crayfish', 'prawn', 'clam', 'mussel', 'oyster', 'scallop', 'squid', 'calamari', 'octopus', 'shellfish', 'seafood', 'mollusks'],
    description = 'Allergic to shellfish and mollusks'
WHERE name = 'Shellfish Allergy';

-- Add Kosher and Halal if they don't exist
INSERT INTO dietary_restrictions (name, allergens, description) VALUES
  ('Kosher', ARRAY['pork', 'bacon', 'ham', 'lard', 'shrimp', 'crab', 'lobster', 'crayfish', 'prawn', 'clam', 'mussel', 'oyster', 'scallop', 'squid', 'calamari', 'octopus', 'shellfish', 'mollusks'], 'Kosher dietary laws - no pork or shellfish/mollusks'),
  ('Halal', ARRAY['pork', 'bacon', 'ham', 'lard', 'alcohol', 'wine', 'beer', 'rum', 'gelatin'], 'Halal dietary laws - no pork or alcohol')
ON CONFLICT (name) DO NOTHING;
