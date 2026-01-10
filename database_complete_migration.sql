/*
  # Complete Database Schema with Functions and Triggers

  ## Overview
  This migration creates the complete database schema for SafeDining,
  including all tables, functions, triggers, and Row Level Security policies.

  ## Tables Created
  1. restaurants - Restaurant profiles and QR codes
  2. menu_items - Dishes with allergen info
  3. ingredients - Detailed ingredient lists per dish
  4. cooking_steps - Preparation instructions
  5. dietary_restrictions - Available dietary filters
  6. customer_profiles - Anonymous customer dietary profiles
  7. chef_requests - Custom dish modification requests

  ## Functions Created
  1. update_updated_at() - Auto-update timestamps on record changes
  2. get_restaurant_by_qr() - Fetch restaurant by QR code

  ## Security
  - RLS enabled on all tables
  - Authenticated users can manage their own restaurant data
  - Anonymous users can read menu data and manage their profiles

  ## How to Run
  1. Go to your Supabase Dashboard
  2. Navigate to SQL Editor
  3. Create a new query
  4. Copy and paste this entire file
  5. Click "Run"
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. Restaurants Table
CREATE TABLE IF NOT EXISTS restaurants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  qr_code text UNIQUE NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  terms_accepted boolean DEFAULT false,
  terms_accepted_at timestamptz,
  onboarding_completed boolean DEFAULT false,
  onboarding_completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Menu Items Table
CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  price numeric(10, 2),
  category text,
  modification_policy text DEFAULT 'no-modifications',
  photo_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Ingredients Table
CREATE TABLE IF NOT EXISTS ingredients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id uuid REFERENCES menu_items(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  quantity text,
  contains_allergens text[] DEFAULT '{}',
  is_removable boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 4. Cooking Steps Table
CREATE TABLE IF NOT EXISTS cooking_steps (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id uuid REFERENCES menu_items(id) ON DELETE CASCADE NOT NULL,
  step_number integer NOT NULL,
  description text NOT NULL,
  equipment text,
  cross_contamination_risk boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 5. Dietary Restrictions Table
CREATE TABLE IF NOT EXISTS dietary_restrictions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text UNIQUE NOT NULL,
  allergens text[] NOT NULL DEFAULT '{}',
  description text,
  icon text,
  created_at timestamptz DEFAULT now()
);

-- 6. Customer Profiles Table
CREATE TABLE IF NOT EXISTS customer_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id text UNIQUE NOT NULL,
  dietary_restrictions text[] DEFAULT '{}',
  severity_level text DEFAULT 'moderate',
  additional_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7. Chef Requests Table
CREATE TABLE IF NOT EXISTS chef_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  menu_item_id uuid REFERENCES menu_items(id) ON DELETE SET NULL,
  customer_profile_id uuid REFERENCES customer_profiles(id) ON DELETE CASCADE NOT NULL,
  dish_name text NOT NULL,
  requested_modifications text NOT NULL,
  dietary_concerns text[] DEFAULT '{}',
  status text DEFAULT 'pending',
  response text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_restaurants_owner ON restaurants(owner_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_qr ON restaurants(qr_code);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_active ON menu_items(is_active);
CREATE INDEX IF NOT EXISTS idx_ingredients_menu_item ON ingredients(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_cooking_steps_menu_item ON cooking_steps(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_session ON customer_profiles(session_id);
CREATE INDEX IF NOT EXISTS idx_chef_requests_restaurant ON chef_requests(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_chef_requests_status ON chef_requests(status);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function 1: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function 2: Get restaurant by QR code (helper for queries)
CREATE OR REPLACE FUNCTION get_restaurant_by_qr(qr_code_input text)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  qr_code text,
  owner_id uuid
) AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.name, r.description, r.qr_code, r.owner_id
  FROM restaurants r
  WHERE r.qr_code = qr_code_input;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at on restaurants
DROP TRIGGER IF EXISTS update_restaurants_updated_at ON restaurants;
CREATE TRIGGER update_restaurants_updated_at
  BEFORE UPDATE ON restaurants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Auto-update updated_at on menu_items
DROP TRIGGER IF EXISTS update_menu_items_updated_at ON menu_items;
CREATE TRIGGER update_menu_items_updated_at
  BEFORE UPDATE ON menu_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Auto-update updated_at on customer_profiles
DROP TRIGGER IF EXISTS update_customer_profiles_updated_at ON customer_profiles;
CREATE TRIGGER update_customer_profiles_updated_at
  BEFORE UPDATE ON customer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Auto-update updated_at on chef_requests
DROP TRIGGER IF EXISTS update_chef_requests_updated_at ON chef_requests;
CREATE TRIGGER update_chef_requests_updated_at
  BEFORE UPDATE ON chef_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooking_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE dietary_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chef_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: Restaurants
-- ============================================================================

DROP POLICY IF EXISTS "Restaurant owners can view own restaurant" ON restaurants;
CREATE POLICY "Restaurant owners can view own restaurant"
  ON restaurants FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Restaurant owners can update own restaurant" ON restaurants;
CREATE POLICY "Restaurant owners can update own restaurant"
  ON restaurants FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Authenticated users can create restaurants" ON restaurants;
CREATE POLICY "Authenticated users can create restaurants"
  ON restaurants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Anyone can view restaurants by QR code" ON restaurants;
CREATE POLICY "Anyone can view restaurants by QR code"
  ON restaurants FOR SELECT
  TO anon
  USING (true);

-- ============================================================================
-- RLS POLICIES: Menu Items
-- ============================================================================

DROP POLICY IF EXISTS "Restaurant owners can view own menu items" ON menu_items;
CREATE POLICY "Restaurant owners can view own menu items"
  ON menu_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = menu_items.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Restaurant owners can insert own menu items" ON menu_items;
CREATE POLICY "Restaurant owners can insert own menu items"
  ON menu_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = menu_items.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Restaurant owners can update own menu items" ON menu_items;
CREATE POLICY "Restaurant owners can update own menu items"
  ON menu_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = menu_items.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = menu_items.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Restaurant owners can delete own menu items" ON menu_items;
CREATE POLICY "Restaurant owners can delete own menu items"
  ON menu_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = menu_items.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Anyone can view active menu items" ON menu_items;
CREATE POLICY "Anyone can view active menu items"
  ON menu_items FOR SELECT
  TO anon
  USING (is_active = true);

-- ============================================================================
-- RLS POLICIES: Ingredients
-- ============================================================================

DROP POLICY IF EXISTS "Restaurant owners can manage ingredients" ON ingredients;
CREATE POLICY "Restaurant owners can manage ingredients"
  ON ingredients FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM menu_items mi
      JOIN restaurants r ON r.id = mi.restaurant_id
      WHERE mi.id = ingredients.menu_item_id
      AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM menu_items mi
      JOIN restaurants r ON r.id = mi.restaurant_id
      WHERE mi.id = ingredients.menu_item_id
      AND r.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Anyone can view ingredients" ON ingredients;
CREATE POLICY "Anyone can view ingredients"
  ON ingredients FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM menu_items
      WHERE menu_items.id = ingredients.menu_item_id
      AND menu_items.is_active = true
    )
  );

-- ============================================================================
-- RLS POLICIES: Cooking Steps
-- ============================================================================

DROP POLICY IF EXISTS "Restaurant owners can manage cooking steps" ON cooking_steps;
CREATE POLICY "Restaurant owners can manage cooking steps"
  ON cooking_steps FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM menu_items mi
      JOIN restaurants r ON r.id = mi.restaurant_id
      WHERE mi.id = cooking_steps.menu_item_id
      AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM menu_items mi
      JOIN restaurants r ON r.id = mi.restaurant_id
      WHERE mi.id = cooking_steps.menu_item_id
      AND r.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Anyone can view cooking steps" ON cooking_steps;
CREATE POLICY "Anyone can view cooking steps"
  ON cooking_steps FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM menu_items
      WHERE menu_items.id = cooking_steps.menu_item_id
      AND menu_items.is_active = true
    )
  );

-- ============================================================================
-- RLS POLICIES: Dietary Restrictions
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view dietary restrictions" ON dietary_restrictions;
CREATE POLICY "Anyone can view dietary restrictions"
  ON dietary_restrictions FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage dietary restrictions" ON dietary_restrictions;
CREATE POLICY "Authenticated users can manage dietary restrictions"
  ON dietary_restrictions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- RLS POLICIES: Customer Profiles
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can manage customer profiles" ON customer_profiles;
CREATE POLICY "Anyone can manage customer profiles"
  ON customer_profiles FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- RLS POLICIES: Chef Requests
-- ============================================================================

DROP POLICY IF EXISTS "Restaurant owners can view own requests" ON chef_requests;
CREATE POLICY "Restaurant owners can view own requests"
  ON chef_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = chef_requests.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Restaurant owners can update own requests" ON chef_requests;
CREATE POLICY "Restaurant owners can update own requests"
  ON chef_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = chef_requests.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = chef_requests.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Anyone can create chef requests" ON chef_requests;
CREATE POLICY "Anyone can create chef requests"
  ON chef_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ============================================================================
-- SEED DATA: Dietary Restrictions
-- ============================================================================

INSERT INTO dietary_restrictions (name, allergens, description) VALUES
  ('Gluten-Free', ARRAY['wheat', 'barley', 'rye', 'flour', 'bread', 'pasta', 'gluten'], 'Avoid gluten-containing grains'),
  ('Dairy-Free', ARRAY['milk', 'cheese', 'butter', 'cream', 'dairy', 'whey', 'casein'], 'Avoid all dairy products'),
  ('Nut Allergy', ARRAY['peanuts', 'almonds', 'walnuts', 'cashews', 'pecans', 'pistachios', 'nuts', 'nut'], 'Severe nut allergies'),
  ('Shellfish Allergy', ARRAY['shrimp', 'crab', 'lobster', 'shellfish', 'seafood'], 'Allergic to shellfish'),
  ('Egg-Free', ARRAY['egg', 'eggs', 'mayonnaise'], 'Avoid eggs and egg products'),
  ('Soy-Free', ARRAY['soy', 'tofu', 'edamame', 'soy sauce'], 'Avoid soy products'),
  ('Fish Allergy', ARRAY['fish', 'salmon', 'tuna', 'cod', 'halibut'], 'Allergic to fish'),
  ('Sesame Allergy', ARRAY['sesame', 'tahini'], 'Allergic to sesame seeds'),
  ('Vegan', ARRAY['meat', 'dairy', 'egg', 'honey', 'gelatin'], 'Plant-based diet'),
  ('Vegetarian', ARRAY['meat', 'chicken', 'beef', 'pork', 'fish'], 'No meat or fish')
ON CONFLICT (name) DO NOTHING;
