-- Recipe Club Migration: Add Photos and Calendar Support
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Add photos column to recipes table
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS photos text[] DEFAULT '{}';

-- Add calendar_event_id column to scheduled_events table
ALTER TABLE scheduled_events ADD COLUMN IF NOT EXISTS calendar_event_id text;

-- Add event_time column to scheduled_events table (defaults to 7pm)
ALTER TABLE scheduled_events ADD COLUMN IF NOT EXISTS event_time text DEFAULT '19:00';

-- Update RLS policies for scheduled_events to allow admins to update any event
-- First, drop the existing update policy
DROP POLICY IF EXISTS "Users can update their own events" ON scheduled_events;

-- Create a new policy that allows any authenticated user to update events
-- (Admin check is done in the application layer)
CREATE POLICY "Authenticated users can update events"
  ON scheduled_events FOR UPDATE TO authenticated USING (true);

-- Similarly for delete
DROP POLICY IF EXISTS "Users can delete their own events" ON scheduled_events;

CREATE POLICY "Authenticated users can delete events"
  ON scheduled_events FOR DELETE TO authenticated USING (true);

-- Update recipes policies to allow admins to delete any recipe
DROP POLICY IF EXISTS "Users can delete their own recipes" ON recipes;

CREATE POLICY "Authenticated users can delete recipes"
  ON recipes FOR DELETE TO authenticated USING (true);
