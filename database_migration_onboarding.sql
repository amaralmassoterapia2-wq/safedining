-- Migration: Add Onboarding Tracking to Restaurants Table
-- Run this SQL in your Supabase SQL Editor

-- Add columns for tracking terms acceptance and onboarding completion
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- Create storage bucket for dish photos if it doesn't exist
-- (Run this in the Supabase Storage section or via SQL)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('dish-photos', 'dish-photos', true)
-- ON CONFLICT (id) DO NOTHING;

-- Set up RLS policy for dish photos bucket
-- CREATE POLICY "Authenticated users can upload dish photos"
-- ON storage.objects FOR INSERT
-- TO authenticated
-- WITH CHECK (bucket_id = 'dish-photos');

-- CREATE POLICY "Public can view dish photos"
-- ON storage.objects FOR SELECT
-- TO public
-- USING (bucket_id = 'dish-photos');
