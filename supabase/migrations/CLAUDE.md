# supabase/migrations/ — schema and data changes

Files are named `YYYYMMDD_what_it_does.sql` and kept in date order.

## How they get applied

There's no `supabase/config.toml` and no migration runner in this workflow: each file has been applied **by hand in the Supabase SQL editor** (or, for plain data updates, through the service-role client). So:

- **A file in this folder is a record, not a pending job.** Check the live database before running one; most are already applied.
- **Write migrations to be safe to re-run:** `add column if not exists`, `create … if not exists`, `on conflict do nothing`, updates guarded by a `where` that matches only the rows meant to change.
- **Data fixes go here too**, even when they were already applied through a script, so the change is on record (e.g. `20261023_lha_short_names.sql` renamed three Lighthouse programmes to their acronyms). Say in the header comment when and how it was applied.

## Keys and cron jobs

- **Never put a key or JWT in a file here.** Cron jobs read the service-role key from Supabase Vault (`20261001_add_clivar_cron.sql` is the template); the one-time Vault setup is pasted into the SQL editor and never committed.
- A cron job that calls an Edge Function with a wrong or missing Vault secret fails silently — the checks are in `supabase/functions/CLAUDE.md`.
- `cron.job` can't be read through the REST API, so the full list of scheduled jobs lives only in Postgres; `lib/data/scrape-schedule.ts` mirrors it for System Health. Change both together.

## Things worth knowing before writing one

- `events.status` is rolled forward nightly by `refresh_event_statuses()` (`20261024_refresh_event_statuses.sql`, cron `refresh-event-statuses-daily` at 00:05 UTC) — scrapers only refresh the events still listed on their site. **That migration was committed before being applied:** run it in the SQL editor if `select * from cron.job where jobname = 'refresh-event-statuses-daily'` returns nothing.
- New `events` rows get `approval_status = 'pending'` from a trigger when none is set (`20260716_pending_on_new_events_trigger.sql`); set it explicitly to import approved history.
- `ipos.type` is `ipo` / `lighthouse` / `secretariat` (`20260903_reclassify_wcrp_org_type.sql`); a query meaning "the 7 IPOs" filters `type = 'ipo'`.
- `events.duplicate_of_event_id` is `on delete set null`; `duplicate_dismissals` cascades on delete.
- **Survey tables** (`20261026_survey_module.sql`, seed `20261026_survey_core_questions.sql`): every `survey_*` table has RLS on, no policies, and `revoke all … from anon, authenticated`; helper functions have `execute` revoked too, since PostgREST exposes public functions as `/rpc/*`. Follow the same pattern for any new survey table. To try a file without keeping it, paste it between `begin;` and `rollback;` in the SQL editor first.
- **Core question order and retiring** (`20261027_core_question_order.sql`, applied 2026-10-27): `survey_questions.core_order` and `retired_at`, managed on the Core questions page. New core questions get the next `core_order`.
- **Survey emails:** `20261026_survey_email.sql` (adds `survey_event_participants.reminders_off_at`) was applied on 2026-10-26; `20261026_survey_email_cron.sql`, not applied yet, (the 10-minute `survey-emails-10min` job calling `/api/surveys/cron`; needs the `surveys_cron_secret` Vault secret, and only once the code is deployed with its env vars).
