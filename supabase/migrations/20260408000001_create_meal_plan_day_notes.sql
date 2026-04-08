-- Create meal_plan_day_notes table for per-day notes on meal plans
CREATE TABLE IF NOT EXISTS meal_plan_day_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, day_of_week)
);

-- Enable RLS
ALTER TABLE meal_plan_day_notes ENABLE ROW LEVEL SECURITY;

-- Users can only read notes for their own meal plans
CREATE POLICY "meal_plan_day_notes_select" ON meal_plan_day_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM meal_plans
      WHERE meal_plans.id = meal_plan_day_notes.plan_id
        AND meal_plans.user_id = auth.uid()
    )
  );

-- Users can insert notes for their own meal plans
CREATE POLICY "meal_plan_day_notes_insert" ON meal_plan_day_notes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM meal_plans
      WHERE meal_plans.id = meal_plan_day_notes.plan_id
        AND meal_plans.user_id = auth.uid()
    )
  );

-- Users can update notes for their own meal plans
CREATE POLICY "meal_plan_day_notes_update" ON meal_plan_day_notes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM meal_plans
      WHERE meal_plans.id = meal_plan_day_notes.plan_id
        AND meal_plans.user_id = auth.uid()
    )
  );

-- Users can delete notes for their own meal plans
CREATE POLICY "meal_plan_day_notes_delete" ON meal_plan_day_notes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM meal_plans
      WHERE meal_plans.id = meal_plan_day_notes.plan_id
        AND meal_plans.user_id = auth.uid()
    )
  );

-- Index for fast lookups by plan
CREATE INDEX IF NOT EXISTS meal_plan_day_notes_plan_id_idx ON meal_plan_day_notes (plan_id);
