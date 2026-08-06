-- Automatically set approval_status = 'pending' for any newly inserted event
-- that doesn't already have an explicit status set.
--
-- This fires only on INSERT (not on the UPDATE side of an upsert), so existing
-- approved events are never downgraded when the scraper re-runs and upserts
-- the same event again.

CREATE OR REPLACE FUNCTION set_approval_pending_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.approval_status IS NULL THEN
    NEW.approval_status := 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_set_approval_pending
  BEFORE INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION set_approval_pending_on_insert();
