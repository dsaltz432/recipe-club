-- Track whether each user's stored Google refresh token still works.
-- Written by the google-calendar edge function every time it tries to use
-- the token (the on-load "status" check, and create/update/delete).
--
-- last_status values:
--   connected      - Google accepted the refresh token and it has calendar scope
--   disconnected   - Google rejected the refresh token (revoked or expired)
--   missing_scope  - token works but calendar access was not granted
--   error          - the check itself failed (network, Google outage, etc.)
ALTER TABLE public.user_tokens
  ADD COLUMN IF NOT EXISTS last_status TEXT,
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
