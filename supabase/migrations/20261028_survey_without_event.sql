-- A survey no longer needs an Academy catalogue event: academy_event_id becomes optional,
-- for stand-alone surveys (New survey → Event → "No event"). Picking an event works as
-- before: still one survey per catalogue event (the unique constraint ignores NULLs), and
-- deleting a catalogue event that has a survey is still refused (on delete restrict).
--
-- Apply by hand in the Supabase SQL editor before deploying the New survey page that offers
-- "No event". Safe to re-run.

alter table survey_events alter column academy_event_id drop not null;

comment on column survey_events.academy_event_id is
  'The Academy catalogue event the survey is about; NULL for a stand-alone survey with no event';
