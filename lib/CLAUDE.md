# lib/ — data access, shared actions, helpers

## Layout

```
supabase/   clients and query helpers
  server.ts     createClient()       — session client; RLS applies. Server Components / route handlers.
  admin.ts      createAdminClient()  — service role, bypasses RLS. Server only, never in a client component.
  client.ts     browser client       — Realtime only.
  fetch-all.ts  fetchAllRows()       — pages a read past PostgREST's 1,000-row cap.
  must.ts       must()               — unwraps { data, error }, throws on error.
auth/       guards.ts — role checks every server action starts with
data/       loaders (server) and pure helpers (anywhere)
actions/    'use server' actions shared by routes in BOTH dashboard trees
hooks/      use-is-client.ts — false on the server render and hydration, true after (time-zone-dependent UI)
surveys/    server-only survey internals, plain helpers taking a client (scripts can call them):
  tokens.ts       personal-link tokens (HMAC of the participant id, SURVEYS_SECRET) + signed device cookie
  base-url.ts     the site address in links / QR codes / emails (SURVEYS_BASE_URL, else the request host)
  participants.ts import, remove, merge
  core-questions.ts  the Core questions page: edit (in place or new version), add, retire, reorder
  respond.ts      the participant side: find the survey, recognise the person, save answers
  email/          config (env), templates (pure, tested), send (SMTP, daily limit, jobs), overview (Send tab)
wordpress/  WordPress REST client + mapper for the Academy catalogue sync
ipo-sources.ts, geo.ts, utils.ts (cn())
```

## Rules

- **Every server action starts with a guard** from `auth/guards.ts`: `requireAcademyAdmin()` for Academy-only actions, `requireCanApprove()` for the Secretariat's, `requireAcademyAdminOrApprover()` for features shared by both (it returns which team called), `requireUser()` for an org account acting on its own `org_id`. Never rely on the page being gated: an action can be called directly.
- **Pure helpers get unit tests** next to them (`x.test.ts`, run by `npm test`); CI (`.github/workflows/ci.yml`) runs lint, tests, type-check and a build on every push.
- **Never drop a query error.** `const rows = must('ipos query', await db.from('ipos').select(...))`. For a result with a count, `must()` the data and read `.count` off the result. Throwing lets the route's `error.tsx` show the failure; swallowing it renders "no data" and nobody notices.
- **Anything that can pass 1,000 rows goes through `fetchAllRows()`**, ordered by a unique column at the end (`.order('start_date').order('id')`). PostgREST truncates silently. Watch whole-table reads of `events` (1,128 rows on 2026-10-24) in particular; a per-org read is fine for now (largest org: CLIVAR, ~400).
- **Loaders are wrapped in React `cache()`** (`getHealthOverview`, `getCoverageRows`, `getClimateAnalytics`, `getLighthouseOrgs`) so several components can call them in one request without repeating the queries.
- **Split server and client code by file:**
  - `x.ts` — the loader; may import `createClient`/`createAdminClient`.
  - `x.types.ts` — interfaces and pure helpers a client component can import (`coverage.types.ts`, `climate-analytics.types.ts`, `academy-events.types.ts`).
  - A plain helper module with no `'use server'` (`data/event-duplicates.ts`, `data/admin-events.ts`) takes a client as an argument; the `'use server'` wrapper in `actions/` adds the role check and `revalidatePath`. Scripts and tests can then call the helper directly with a service client.
- **`actions/` is only for actions used by both trees** (`/dashboard/academy/*` and `/dashboard/ipo/*`), each re-checking the role server-side: `event-duplicates.ts` (Duplicates), `admin-events.ts` (add/edit/delete any org's event). Route-only actions stay in that route's `actions.ts`.
- **Dates:** `events.start_date` is an ISO day string; trend maths (`data/event-trends.ts`) compares strings against "today" in UTC.
- **Org labels:** `ipos.name` is the short label, `ipos.full_name` the long form; group dropdowns with `groupOrgsByType()` and show both with `orgFullLabel()` (`data/org-groups.ts`). Lighthouse programmes come from `getLighthouseOrgs()` (`data/lighthouses.ts`), never a hardcoded id list.

## Loaders at a glance

| File | Used by | Reads with |
|---|---|---|
| `data/health.ts` | System Health | admin |
| `data/coverage.ts` | Gap Analysis coverage table | session |
| `data/climate-analytics.ts` | Climate Analytics (can_approve) | admin |
| `data/lighthouses.ts` | LHA Accounts page + actions | admin |
| `data/academy-events.ts` | Academy catalogue | session |
| `data/scrape-schedule.ts` | System Health schedule (mirror of the pg_cron jobs) | — |
| `data/surveys.ts` | Surveys pages (each loader calls `requireAcademyAdmin()` first; survey tables have no RLS policies) | admin |

Survey pure helpers, tested: `data/survey-setup.ts` (slugs, suggested windows, stage windows, validation shared by forms and actions, `datetime-local` conversion, time zone label), `data/survey-progress.ts` (participants / before / after / matched / match rate), `data/survey-participants.ts` (email lists, typo hints, statuses), `data/survey-answers.ts` (checking submitted answers), `data/survey-email-rules.ts` (when each email goes, to whom), `data/survey-results.ts` (results, small groups hidden) and `data/csv.ts` (CSV with formula-injection guard). Types and labels: `data/surveys.types.ts`.
