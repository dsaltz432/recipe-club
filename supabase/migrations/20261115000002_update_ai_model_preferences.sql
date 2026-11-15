-- Move saved AI model preferences to the current Claude models. Sonnet 4.6 was
-- the old default, so it moves to the new default (Opus 5.5); others keep their tier.
UPDATE user_preferences SET ai_model_parse = CASE ai_model_parse
    WHEN 'claude-haiku-4-5-20251001' THEN 'claude-haiku-5-5'
    WHEN 'claude-haiku-4-5' THEN 'claude-haiku-5-5'
    WHEN 'claude-sonnet-4-6' THEN 'claude-opus-5-5'
    WHEN 'claude-opus-4-6' THEN 'claude-opus-5-5'
    ELSE ai_model_parse
  END,
  ai_model_combine = CASE ai_model_combine
    WHEN 'claude-haiku-4-5-20251001' THEN 'claude-haiku-5-5'
    WHEN 'claude-haiku-4-5' THEN 'claude-haiku-5-5'
    WHEN 'claude-sonnet-4-6' THEN 'claude-opus-5-5'
    WHEN 'claude-opus-4-6' THEN 'claude-opus-5-5'
    ELSE ai_model_combine
  END;

ALTER TABLE user_preferences
  ALTER COLUMN ai_model_parse SET DEFAULT 'claude-opus-5-5',
  ALTER COLUMN ai_model_combine SET DEFAULT 'claude-opus-5-5';
