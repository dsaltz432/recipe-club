-- Cache for smart-combined grocery lists per event
CREATE TABLE event_grocery_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE REFERENCES scheduled_events(id) ON DELETE CASCADE,
  items JSONB NOT NULL,
  recipe_ids TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE event_grocery_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read" ON event_grocery_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert" ON event_grocery_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update" ON event_grocery_cache FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete" ON event_grocery_cache FOR DELETE TO authenticated USING (true);
