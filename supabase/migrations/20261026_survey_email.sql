-- Survey emails, Phase 6 (docs/surveys/PLAN.md section 9): lets a participant stop the
-- reminder emails of one survey ("Stop reminders for this survey" in every email's footer).
-- Invites and the thank-you email still go; only reminders are skipped.
--
-- Applied 2026-10-26 by hand in the Supabase SQL editor. Safe to re-run.

alter table survey_event_participants
  add column if not exists reminders_off_at timestamptz;

comment on column survey_event_participants.reminders_off_at is
  'Set when the person clicked "Stop reminders for this survey"; reminder emails skip them';
