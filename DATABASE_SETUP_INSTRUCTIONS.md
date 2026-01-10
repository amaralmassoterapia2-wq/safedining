# Database Setup Instructions

This guide walks you through setting up your complete database schema with all necessary functions, triggers, and security policies.

## Overview

Your SafeDining app requires a complete PostgreSQL database with:
- **7 tables** for storing restaurants, menus, customer profiles, and requests
- **2 functions** for automated timestamp updates and QR code lookups
- **4 triggers** that automatically maintain timestamps
- **20 RLS policies** for secure data access
- **10 dietary restrictions** as seed data

## Quick Start

### Step 1: Run the Migration

1. Go to your Supabase Dashboard: https://lupmvhppsfvvzoligglz.supabase.co
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open the file: `database_complete_migration.sql`
5. Copy the entire contents
6. Paste into the SQL Editor
7. Click **Run** (or press Cmd/Ctrl + Enter)

You should see: `Success. No rows returned`

### Step 2: Verify Everything is Set Up

1. In the SQL Editor, click **New Query**
2. Open the file: `database_verification.sql`
3. Copy the entire contents
4. Paste into the SQL Editor
5. Click **Run**

### Step 3: Check the Results

Scroll through the verification results and confirm:

#### ✅ Expected Results

**Tables Check:**
- Should show 7 tables: `chef_requests`, `cooking_steps`, `customer_profiles`, `dietary_restrictions`, `ingredients`, `menu_items`, `restaurants`

**Functions Check:**
- Should show 2 functions: `get_restaurant_by_qr`, `update_updated_at`

**Triggers Check:**
- Should show 4 triggers for auto-updating timestamps

**RLS Status:**
- All 7 tables should have `rls_enabled = true`

**RLS Policies Count:**
- restaurants: 4 policies
- menu_items: 6 policies
- ingredients: 2 policies
- cooking_steps: 2 policies
- dietary_restrictions: 2 policies
- customer_profiles: 1 policy
- chef_requests: 3 policies

**Seed Data:**
- Should show 10 dietary restrictions

**Summary:**
- Tables: 7/7
- Functions: 2/2
- Triggers: 4/4
- Seed Data: 10/10
- RLS Policies: 20/20

## What Was Created

### 1. Tables

#### `restaurants`
Stores restaurant information and owner authentication.
- Links to `auth.users` via `owner_id`
- Has unique QR codes for each restaurant
- Tracks onboarding completion

#### `menu_items`
All dishes offered by restaurants.
- Linked to restaurants
- Can be active/inactive
- Includes modification policy

#### `ingredients`
Detailed ingredient lists for each dish.
- Linked to menu items
- Contains allergen arrays
- Marks if ingredient is removable

#### `cooking_steps`
Preparation instructions for dishes.
- Linked to menu items
- Tracks cross-contamination risks
- Ordered by step number

#### `dietary_restrictions`
Available dietary filters (Gluten-Free, Vegan, etc.).
- Pre-populated with 10 common restrictions
- Contains allergen lists for matching

#### `customer_profiles`
Anonymous customer dietary profiles.
- Uses session IDs (no authentication required)
- Stores dietary restrictions and severity level
- Anonymous and privacy-focused

#### `chef_requests`
Customer requests for dish modifications.
- Links restaurant, menu item, and customer
- Tracks status (pending, approved, declined)
- Allows chef responses

### 2. Functions

#### `update_updated_at()`
**Purpose:** Automatically updates the `updated_at` timestamp whenever a record is modified.

**Usage:** Applied via triggers (automatic)

**Tables affected:** `restaurants`, `menu_items`, `customer_profiles`, `chef_requests`

#### `get_restaurant_by_qr(qr_code_input text)`
**Purpose:** Helper function to fetch restaurant details by QR code.

**Usage:**
```sql
SELECT * FROM get_restaurant_by_qr('your-qr-code-here');
```

**Returns:** Restaurant id, name, description, qr_code, owner_id

### 3. Triggers

Four triggers automatically call `update_updated_at()`:
- `update_restaurants_updated_at`
- `update_menu_items_updated_at`
- `update_customer_profiles_updated_at`
- `update_chef_requests_updated_at`

These ensure timestamps are always accurate without manual code.

### 4. Row Level Security (RLS)

All tables have RLS enabled with carefully designed policies:

**Restaurants:**
- Owners can manage their own restaurants
- Anyone can view by QR code (for menu access)

**Menu Items, Ingredients, Cooking Steps:**
- Owners can manage their restaurant's data
- Anonymous users can read active menu items

**Customer Profiles:**
- Open access for anonymous customers (session-based)

**Chef Requests:**
- Owners can view/update requests for their restaurant
- Anyone can create requests

### 5. Indexes

9 performance-optimized indexes on:
- Foreign keys
- Frequently queried columns
- QR code lookups
- Status filters

## Troubleshooting

### Error: "relation already exists"
This is fine! It means the table was already created. The migration uses `CREATE TABLE IF NOT EXISTS` to be idempotent.

### Error: "policy already exists"
The migration drops existing policies before recreating them. This ensures they're up-to-date.

### Missing Tables
If verification shows missing tables, rerun the migration script.

### Missing Seed Data
If you see fewer than 10 dietary restrictions, run:
```sql
SELECT * FROM dietary_restrictions;
```
If empty, rerun the seed data section from the migration file.

## Next Steps

### 1. Create Storage Bucket for Dish Photos

Go to **Storage** in Supabase Dashboard:
1. Click **New Bucket**
2. Name it: `dish-photos`
3. Make it **Public**
4. Click **Create**

Then run these policies in SQL Editor:
```sql
CREATE POLICY "Authenticated users can upload dish photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'dish-photos');

CREATE POLICY "Anyone can view dish photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'dish-photos');

CREATE POLICY "Owners can delete their dish photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'dish-photos');
```

### 2. Test Your App

1. Start your development server: `npm run dev`
2. Register a restaurant account
3. Complete the onboarding flow
4. Add menu items with ingredients
5. Scan the QR code as a customer

### 3. Monitor Your Database

Use these queries for insights:

**Count restaurants:**
```sql
SELECT COUNT(*) FROM restaurants;
```

**Count menu items:**
```sql
SELECT COUNT(*) FROM menu_items WHERE is_active = true;
```

**View recent chef requests:**
```sql
SELECT * FROM chef_requests
ORDER BY created_at DESC
LIMIT 10;
```

**Popular dietary restrictions:**
```sql
SELECT
  unnest(dietary_restrictions) as restriction,
  COUNT(*) as count
FROM customer_profiles
GROUP BY restriction
ORDER BY count DESC;
```

## Database Functions Summary

| Function | Purpose | Used By |
|----------|---------|---------|
| `update_updated_at()` | Auto-update timestamps | Triggers (automatic) |
| `get_restaurant_by_qr()` | Fetch restaurant by QR | Application queries |
| Supabase Auth | Login/Registration | `AuthContext.tsx` |

## Registration & Login

**No custom functions needed!** Your app uses Supabase Auth out-of-the-box:

- `supabase.auth.signUp()` - Creates users in `auth.users`
- `supabase.auth.signInWithPassword()` - Authenticates users
- `supabase.auth.signOut()` - Logs out users

All handled by `src/contexts/AuthContext.tsx`

## Support

If you encounter issues:
1. Check the verification queries results
2. Review Supabase logs in the Dashboard
3. Ensure your `.env` file has correct Supabase credentials
4. Check that RLS policies are enabled (they should be!)

## Files Reference

- `database_complete_migration.sql` - Main migration file
- `database_verification.sql` - Verification queries
- `database_migration_onboarding.sql` - Additional onboarding columns (already included in main migration)
- `DATABASE_SETUP_INSTRUCTIONS.md` - This file
