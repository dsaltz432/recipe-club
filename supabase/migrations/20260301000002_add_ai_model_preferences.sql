ALTER TABLE user_preferences
  ADD COLUMN ai_model_parse TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  ADD COLUMN ai_model_combine TEXT NOT NULL DEFAULT 'claude-sonnet-4-6';
