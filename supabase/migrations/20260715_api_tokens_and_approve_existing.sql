-- 1. Bulk-approve all existing IPO events (approval_status IS NULL).
--    These were scraped before the approval system existed and are already
--    on the public calendar. Setting them to 'approved' keeps the calendar
--    unchanged while making the approval_status column the single source
--    of truth for what is publicly visible.
UPDATE events
SET approval_status = 'approved'
WHERE approval_status IS NULL;

-- 2. Add 'approved' as a valid value in the check constraint.
--    The previous migration only allowed NULL | 'pending' | 'approved' as
--    free text — no constraint existed, so this is safe to add now.
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_approval_status_check;

ALTER TABLE events
  ADD CONSTRAINT events_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- 3. Create api_tokens table.
--    Raw tokens are never stored — only a SHA-256 hash.
--    token_prefix stores the first 8 chars of the raw token for display.
CREATE TABLE IF NOT EXISTS api_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  token_hash   text        NOT NULL UNIQUE,
  token_prefix text        NOT NULL,
  created_by   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

-- Only the token owner can read/delete their own tokens.
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can select own tokens"
  ON api_tokens FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "owner can insert own tokens"
  ON api_tokens FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "owner can delete own tokens"
  ON api_tokens FOR DELETE
  USING (auth.uid() = created_by);
