-- Add optional title column to scheduled_events (used by personal events)
ALTER TABLE scheduled_events ADD COLUMN IF NOT EXISTS title TEXT;
