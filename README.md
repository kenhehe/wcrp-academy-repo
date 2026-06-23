# WCRP Academy Dashboard

A private admin dashboard for the World Climate Research Programme (WCRP) to track events across 7 International Programme Offices (IPOs) and audit their presence in the WCRP Academy training catalogue.

---

## What Does This System Do?

It has two jobs:

**1. Scrape IPO event listings** — Seven IPO websites are scraped automatically on a schedule. Each scraper visits the IPO's events page, parses the HTML, and stores the events in the `events` table.

**2. Audit the Academy catalogue** — The WCRP Academy WordPress site (`wcrp-academy.org`) is synced into the `academy_events` table. The dashboard then shows which Academy events have been traced back to an IPO source, and which IPO events are missing from the Academy.

---

## The Two Data Worlds

Understanding this distinction is essential for working with the codebase.

| Table | Source | Purpose |
|---|---|---|
| `events` | Scraped from 7 IPO websites | Raw events as published by each IPO |
| `academy_events` | Synced from WordPress via `sync-academy-wp` | The WCRP Academy training catalogue |

**The link between them:** `events.academy_event_id` is a foreign key to `academy_events.id`. When this column is set, the IPO event has been matched to an Academy catalogue entry. This is how coverage is calculated.

**`events.in_academy`** — a boolean shortcut. `true` means the event is accounted for in the Academy (either linked via `academy_event_id`, or manually marked). Used for fast "is this missing?" queries.

---

## The 7 IPOs

| ID | Name | Scraper |
|---|---|---|
| `gewex` | GEWEX | `scrape-gewex` |
| `cordex` | CORDEX | `scrape-cordex` |
| `esmo` | ESMO | `scrape-esmo` |
| `rifs` | RIfS | `scrape-rifs` |
| `cmip` | CMIP | `scrape-cmip` |
| `clic` | CliC | `scrape-clic` |
| `clivar` | CLIVAR | `scrape-clivar` |

---

## Dashboard Pages

### System Health — `/dashboard/academy/health`
The control room. Run scrapers manually, preview what a scraper would find before committing, view logs from every run, see cron schedules, and monitor for errors.

Key components: `TriggerButton` (run a scraper), `ScrapePreviewDialog` (dry-run modal), `RealtimeHealthSync` (live log updates via Supabase Realtime).

### Academy Coverage — `/dashboard/academy/events`
Shows every event in the Academy catalogue and whether it has been linked to an IPO source. The coverage % in the progress bar = matched ÷ (total − not-IPO-events).

Three states per row:
- **Matched** (green) — has an `academy_event_id` pointing to a scraped IPO event
- **Needs review** (amber) — no IPO link found yet
- **Not an IPO event** (gray) — confirmed as coming from outside the 7 IPOs; excluded from coverage %

### Gap Analysis — `/dashboard/academy/gaps`
Shows IPO events where `in_academy = false` — i.e., events scraped from IPO sites that have not been matched to the Academy catalogue yet.

For each missing event, the system runs a fuzzy text match (`find_fuzzy_matches` PostgreSQL RPC using `pg_trgm`) to suggest possible Academy matches. Rows are sorted by fuzzy score descending.

Actions available per row:
- **Yes, same event** — confirms a fuzzy suggestion, writes `academy_event_id` to the `events` row
- **Already in Academy** — marks `in_academy = true` without a specific link (used when you know it's covered but the suggestion is wrong)
- **Link manually** — opens a search dialog to find and link the correct Academy event by title

### IPO Events — `/dashboard/ipo/events`
Browse all scraped events across all 7 IPOs. Filter by IPO, status, year.

### Catalogue — `/dashboard/academy/catalogue`
Full CRUD editor for `academy_events`. Create, edit, or delete Academy catalogue entries manually.

### Accounts — `/dashboard/academy/accounts`
User management for dashboard access.

### Import — `/dashboard/academy/import` and `/dashboard/ipo/import`
Bulk CSV import for Academy events and IPO events respectively.

---

## Running Locally

### Prerequisites
- Node.js 20+
- Supabase CLI (`npm install -g supabase`)
- A `.env.local` file with:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Commands

```bash
# Start the dev server
npm run dev

# Type-check (no test runner configured — use this instead)
npx tsc --noEmit

# Lint
npm run lint
```

The app runs at `http://localhost:3000`. The dashboard is behind auth — log in at `/login`.

---

## How the Next.js Data Flow Works

This is the part most likely to confuse you if you didn't write it. Read this carefully.

### Two kinds of components

**Server Components** (the default — any file without `'use client'` at the top):
- Run on the server during the request, never in the browser
- Can use `async/await` directly — `const supabase = await createClient(); const { data } = await supabase.from(...)`
- Cannot use `useState`, `useEffect`, `onClick`, or any browser API
- This is where all the data fetching happens

**Client Components** (files that start with `'use client'`):
- Run in the browser
- Can use React hooks (`useState`, `useEffect`, etc.) and handle user interactions
- Cannot call Supabase directly
- When they need to mutate data, they call a **Server Action**

### Server Actions

Server Actions are functions in `actions.ts` files marked with `'use server'`. They run on the server but can be called from client components like regular async functions.

```
Client Component (browser)
  → calls confirmMatch(formData)   ← Server Action
    → runs on server
    → writes to Supabase (using createAdminClient())
    → calls revalidatePath() to tell Next.js to re-fetch page data
    → page automatically refreshes with new data
```

**Why `createAdminClient()` in Server Actions?** It uses the Supabase service role key, which bypasses Row Level Security. Use it for writes. Use `createClient()` (from `lib/supabase/server.ts`) for reads — it respects the logged-in user's permissions.

### The standard page pattern

```
app/dashboard/academy/gaps/
├── page.tsx          ← Server Component. Fetches all data, renders layout.
├── actions.ts        ← Server Actions. All DB mutations live here.
├── loading.tsx       ← Shown while page.tsx is loading (Suspense boundary).
├── error.tsx         ← Shown if page.tsx throws.
└── _components/
    ├── GapsTable.tsx         ← Server Component (note: no 'use client')
    ├── ManualMatchDialog.tsx ← Client Component ('use client') — needs useState
    └── MarkInAcademyButton.tsx ← Client Component — handles button click + form
```

`_components/` (underscore prefix) means these are private to this route — not shared across pages.

### `Suspense` for streaming

Some pages wrap heavy components in `<Suspense fallback={<Skeleton />}>`. This lets the page shell render immediately while the slow data loads separately. The `key` prop on `<Suspense>` forces a remount when filters change.

### `export const dynamic = 'force-dynamic'`

Any page file with this export tells Next.js: never cache this page, always fetch fresh data on every request. All dashboard pages use this because data changes frequently.

---

## Supabase Edge Functions (Scrapers)

The scrapers run as Supabase Edge Functions — serverless functions on Deno (not Node.js). They are in `supabase/functions/`.

### Key difference from Node.js

Edge Functions use Deno's import syntax:
```typescript
import { parse } from 'npm:node-html-parser'               // npm package
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2' // CDN
import { parseDateRange } from '../_shared/utils.ts'        // local file
```

### Shared utilities (`supabase/functions/_shared/`)

All scrapers import from here. Do not duplicate logic.

| Export | Purpose |
|---|---|
| `parseDateRange(str)` | Parses "15–18 Sep 2024" → `{ start: '2024-09-15', end: '2024-09-18' }` |
| `parseDate(str)` | Parses a single date string → `'2024-09-15'` or `null` |
| `computeStatus(start, end)` | Returns `'Upcoming' \| 'Ongoing' \| 'Past'` based on today |
| `fetchWithRetry(url)` | HTTP fetch with 3 retries and exponential backoff |
| `upsertEvents(supabase, events)` | Validates + batch-upserts events to DB |
| `startRun / finishRun` | Updates the `scrape_runs` table (shown on Health page) |
| `dryRunStream(...)` | Returns a streaming response for the preview dialog |
| `isFreshScrape / peekFirstTitle` | Freshness check — skip scrape if site hasn't changed |

**Critical gotcha with `parseDateRange`:** The function uses `^`-anchored regex patterns. Pass only the date substring, not the full paragraph text. Extract the date chunk first with a separate match, then call `parseDateRange` on it.

### Deploying a scraper

After changing a scraper, push the code to git AND redeploy the function:

```bash
# Deploy one function
supabase functions deploy scrape-gewex

# Deploy several at once
supabase functions deploy scrape-rifs scrape-esmo scrape-gewex scrape-cordex

# Deploy the Academy sync
supabase functions deploy sync-academy-wp
```

Git push alone does NOT deploy — you must run the deploy command separately.

---

## Common Debugging

### A scraper shows "failed" on the Health page

1. Click on the run row to see the error message
2. Common causes:
   - **"0 events but IPO has events in DB"** — The website changed its HTML structure. The parser selectors no longer match. Check `parseEvents()` in the scraper file against the live site's HTML.
   - **Date parse failure** — A date format on the site doesn't match any pattern in `_shared/utils.ts`. Add a new pattern to `parseDateRange`.
   - **HTTP error** — The site returned a non-200 status or the URL changed.

### Scraper shows "skipped"

The freshness check (`peekFirstTitle` / `isFreshScrape`) found that the first event on the page is already in the database. This is intentional — the site hasn't changed since the last scrape. Use "Force re-run" on the Health page to override.

### A date column shows blank in the UI

The event has `start_date = null`. For Academy events, this usually means it's an on-demand course. `resolveStatus()` in `lib/data/academy-events.types.ts` derives a label from the status/publish_date as a fallback.

### Type errors after a change

```bash
npx tsc --noEmit
```

There is no `npm run type-check` script — use `npx tsc --noEmit` directly.

---

## How to Add a New IPO Scraper

1. **Create the function** — Copy `supabase/functions/scrape-gewex/index.ts` as a template. Change `IPO_ID`, `BASE`, `LIST`, and write a new `parseEvents()` function for the site's HTML structure.

2. **Register the IPO ID** — Add a row to the `ipos` table in Supabase: `{ id: 'new-ipo', name: 'New IPO Name' }`.

3. **Register the scraper** — Add it to `FUNCTION_MAP` in `app/dashboard/academy/health/actions.ts`:
   ```typescript
   new-ipo: 'scrape-new-ipo',
   ```

4. **Deploy** — `supabase functions deploy scrape-new-ipo`

5. **Test** — Use the "Preview" button on the Health page (dry run) before running for real.

---

## Project Structure At a Glance

```
app/
  dashboard/
    academy/
      health/     → System Health page (scrapers, logs)
      events/     → Academy Coverage page (audit)
      gaps/       → Gap Analysis page (missing events)
      catalogue/  → CRUD editor for academy_events
      accounts/   → User management
      import/     → Bulk import
    ipo/
      events/     → Browse IPO scraped events
      import/     → Bulk import for IPO events

components/
  ui/       → shadcn/ui primitives (CLI-managed, don't edit manually)
  base/     → Project-specific wrappers (PageInfo, etc.)
  [feature]/ → Domain components used across multiple pages

lib/
  supabase/
    server.ts   → createClient() — user-session Supabase client
    admin.ts    → createAdminClient() — service-role client (server-only)
    client.ts   → Browser-side Supabase client (for Realtime subscriptions)
  data/
    academy-events.types.ts → AcademyEventRow type, resolveStatus()

supabase/
  functions/
    _shared/    → utils.ts + types.ts — shared scraper utilities
    scrape-*/   → One function per IPO
    sync-academy-wp/ → Syncs WordPress catalogue to academy_events table
  migrations/   → SQL migrations run against the Supabase DB
```
