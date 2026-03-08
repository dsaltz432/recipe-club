-- Table: cook_mode_timelines — cached AI-generated interleaved cooking timelines
CREATE TABLE cook_mode_timelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES scheduled_events(id) ON DELETE CASCADE,
  recipe_ids_hash TEXT NOT NULL,
  steps JSONB NOT NULL,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, recipe_ids_hash)
);

-- Index for fast lookups
CREATE INDEX idx_cook_mode_timelines_event_id ON cook_mode_timelines(event_id);
CREATE INDEX idx_cook_mode_timelines_hash ON cook_mode_timelines(event_id, recipe_ids_hash);

-- RLS policies
ALTER TABLE cook_mode_timelines ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read
CREATE POLICY "Authenticated users can view cook mode timelines"
  ON cook_mode_timelines FOR SELECT
  TO authenticated
  USING (true);

-- Service role can do everything (edge functions use service role key)
CREATE POLICY "Service role can manage cook mode timelines"
  ON cook_mode_timelines FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
