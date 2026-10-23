# app/api/ — route handlers

## `v1/events` — the public events API

The only route used outside this app; changes here reach whoever consumes WCRP events.

- **Auth:** `Authorization: Bearer <token>`. The token is SHA-256 hashed and looked up in `api_tokens` (tokens are created on `/dashboard/ipo/api-keys`); `last_used_at` is updated on each call.
- **`proxy.ts` must let `/api/v1/` through without a session** (`isPublicApi`). Every other path without a session is redirected to `/login`; until 2026-10-24 that included this route, so token callers got a 307 to the login page and the API couldn't be used from outside the app. Any new token-authenticated route needs the same exception.
- **Data:** approved events only (`approval_status = 'approved'`), every org, ordered by `start_date` then `id`, read with `fetchAllRows()` (approved events are past 1,000).
- **Filters:** `?status=Upcoming|Ongoing|Past|Cancelled|Postponed`, `?ipo=<ipos.id>`, `?type=ipo|lighthouse`.
- **Response:** `{ count, events: [{ id, title, start_date, end_date, status, location, country, url, ipo_id, ipo_name, type }] }`. `ipo_name` is `ipos.name`, the short label — since 2026-10-23 that's `DE` / `MCR` / `SLC` for those programmes, not their full names.
- **Errors:** this route returns JSON with a status (401 bad token, 500 query failure, logged with `console.error`) instead of throwing, so consumers get a parseable answer.
- Don't add fields or rename existing ones without telling the consumers; adding an optional field is safe, removing or renaming one is not.

## Internal routes (signed-in users only)

- `scrape/preview/[ipoId]` (POST) — runs a scraper with `{ dry_run: true }` for the Preview dialog on System Health; `academy_admin` only (403 for org accounts); calls the Edge Function with the service-role key server-side.
- `academy/events` and `academy/events/[id]` — read (any signed-in user) and create/update (`academy_admin`) the Academy catalogue. No page in this app calls them today; check for outside users before removing.

There is no cron route any more: scraping is scheduled only by `pg_cron` (see `supabase/functions/CLAUDE.md`).
