# Dashboard Pages — Patterns & Guide

## Page Structure (every route follows this)

```
page.tsx          Server Component. Fetches data, renders the full page.
actions.ts        Server Actions ('use server'). All DB mutations.
loading.tsx       Shown while page.tsx is loading. Usually renders a Skeleton.
error.tsx         Error boundary ('use client' required by Next.js).
_components/      Private to this route. Not imported by other pages.
```

## How Data Flows Through a Page

```
page.tsx (Server Component)
  ↓ const supabase = await createClient()
  ↓ const { data } = await supabase.from('table').select(...)
  ↓ renders layout, passes data to child components
    └── SomeClientButton.tsx ('use client')
          ↓ user clicks → calls doThing() from actions.ts
            └── actions.ts ('use server')
                  ↓ const db = createAdminClient()
                  ↓ await db.from('table').update(...)
                  ↓ revalidatePath('/dashboard/...')
                  ↑ Next.js re-runs page.tsx, page updates
```

**Rule of thumb:** Fetch with `createClient()` (respects user session). Mutate with `createAdminClient()` (bypasses RLS, server-only).

**Exception — features rendered from more than one route tree:** `academy/duplicates` and `ipo/duplicates` are two different routes (different auth gates: `academy_admin` vs `can_approve`) that render the *same* component and call the *same* mutations. Per-route `actions.ts` doesn't fit there — the Server Actions live once in `lib/actions/event-duplicates.ts` instead, imported by both pages' shared `components/duplicates/` components. Reach for this pattern only when a feature is genuinely reachable from multiple trees; a single-route feature still keeps its mutations in that route's own `actions.ts`.

## When to Use `'use client'`

Add it only when the component needs:
- `useState` / `useEffect` / `useTransition`
- Event handlers (`onClick`, `onChange`, etc.)
- Browser APIs

If a component just renders HTML from props, keep it a Server Component.

## searchParams Pattern

Pages that accept URL filters receive `searchParams` as a Promise (Next.js 15):

```typescript
interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function MyPage({ searchParams }: PageProps) {
  const sp     = await searchParams
  const filter = typeof sp.filter === 'string' ? sp.filter : undefined
  const page   = Math.max(1, parseInt(typeof sp.page === 'string' ? sp.page : '1'))
  ...
}
```

Always guard with `typeof sp.x === 'string'` — URL params can be arrays.

## Pagination Pattern

```typescript
const PAGE_SIZE = 25
const { data, count } = await supabase
  .from('table')
  .select('...', { count: 'exact' })
  .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)
```

## `Suspense` for Heavy Table Components

Wrap slow data-fetching components in `<Suspense>` so the page shell renders immediately:

```typescript
<Suspense key={`${filter}-${page}`} fallback={<MyTableSkeleton />}>
  <MyTable filter={filter} page={page} />
</Suspense>
```

The `key` forces a remount (and re-fetch) when filters change.

## `export const dynamic = 'force-dynamic'`

Put this at the top of every page that shows live data. It disables Next.js caching for that route. All dashboard pages use it.

## Page-by-Page Reference

### `academy/health`
- Reads `scrape_runs` table for history
- `TriggerButton` fires a Server Action → calls the Supabase Edge Function via `fetch()`
- `ScrapePreviewDialog` opens a dialog, calls the Edge Function with `{ dry_run: true }`, reads the NDJSON response stream live
- `RealtimeHealthSync` subscribes to `scrape_runs` via Supabase Realtime and refreshes the page when a run completes

### `academy/events` (Academy Coverage)
- Source: `academy_events` table
- Three states per row: Matched / Needs review / Not an IPO event
- `is_external = true` → Not an IPO event (excluded from coverage %)
- `matchedIpoMap` built from `events` table (rows where `academy_event_id` is set)
- Coverage % = `matchedCount / (total - externalCount)`

### `academy/gaps` (Gap Analysis)
- Source: `events` table where `in_academy = false` and `duplicate_of_event_id is null` (a confirmed cross-IPO duplicate doesn't show as a second, redundant gap — see `academy/duplicates` below)
- Fuzzy suggestions come from `find_fuzzy_matches` PostgreSQL RPC (`pg_trgm`) — **not committed as a migration**, lives only in the live DB; treat it as a black box, don't assume its SQL body without pulling it first
- Threshold: 0.35 (raised from 0.15 to reduce noise)
- Rows sorted by fuzzy score descending (high confidence first)
- Three actions: "Yes same event" (writes `academy_event_id`), "Already in Academy" (sets `in_academy=true`), "Link manually" (ManualMatchDialog)
- `ManualMatchDialog`: searches `academy_events` table locally; if no results, offers "Sync from Academy" button that calls `sync-academy-wp` edge function
- `markInAcademy`/`confirmMatch` in `actions.ts` both call `setAcademyStatus()` (`lib/data/event-duplicates.ts`) instead of updating `in_academy`/`academy_event_id` directly — this propagates the change to a linked duplicate pair too, so matching either side to the Academy catalogue keeps both in sync

### `academy/duplicates` and `ipo/duplicates` (Cross-IPO Duplicates)
- Same real-world event scraped independently from two different IPO sites (e.g. a jointly-organised conference) — a different problem from Gap Analysis, which matches `events` against `academy_events`; this matches `events` against `events`
- Two routes, one shared implementation: `academy/duplicates` (gated `role==='academy_admin'`) and `ipo/duplicates` (gated `can_approve`, same guard as `approvals/page.tsx`) both render `components/duplicates/DuplicatesReview`
- `find_cross_ipo_duplicate_pairs` PostgreSQL RPC (`pg_trgm`, migration `20260901_duplicate_pairs_and_dismissals.sql`) returns **paginated candidate pairs directly** (not individual events enriched with a match) — same-`start_date` + title similarity, threshold 0.35, `e1.id < e2.id` canonicalizes each pair so it's returned once
- Each pair renders as a card (both events side by side) with **"Same event"** (`linkDuplicate` — sets `duplicate_of_event_id`, syncs Academy status both ways) and **"Not same event"** (`dismissDuplicate` — inserts into `duplicate_dismissals`, permanently excluded from future RPC results via a `not exists` check)
- `duplicate_dismissals` has RLS enabled with **no policies** — default-deny for anon/authenticated; the app only ever touches it via `createAdminClient()` (service role), which bypasses RLS regardless, so this blocks direct public REST access without affecting the app
- "Confirmed duplicates" section lists linked pairs with an **Undo** button (`unlinkDuplicate`) — linking is always reversible, no row is ever deleted
- Global "Link two events manually" button (not per-row) opens a two-sided search dialog for duplicates the fuzzy matcher misses entirely
- Both IPOs keep full, unmodified credit in `ipo_coverage_stats` and their own event counts when a link is made — linking is additive metadata, never a per-IPO credit transfer (see `CLAUDE.md` root for the `duplicate_of_event_id` link)

### `academy/catalogue`
- Full CRUD for `academy_events`
- `AcademyEventForm` is a large form component — edit it in `_components/AcademyEventForm.tsx`
- Uses `AcademyEventInput` type from `lib/data/academy-events.types.ts`

### `ipo/events`
- Source: `events` table (all 7 IPOs combined)
- Filter by ipo_id, status, year via URL params
- Add/Edit/Delete modal (`components/events/EventsTable` + `components/events/EventForm`, submitted via `createEvent`/`updateEvent`/`deleteEvent` in `actions.ts`) — a manual single-event submission form, intended for Lighthouse Activity (LHA) use. **Not actually code-gated to lighthouse orgs today** — the "Add event" button renders for any IPO org, so a regular IPO account can technically create a manual event too; known gap, not yet fixed.
- Includes three publication-preference checkboxes (`wants_social_media`, `wants_website_article`, `wants_newsletter`) — a client (Secretariat) request: let the organizer flag interest in being considered for those channels, purely informational, no automatic publication. Surfaced to reviewers as small icons on `ipo/approvals` (see below). Real boolean columns on `events`, not `extra_fields` — they're a fixed, universal question set, not a per-IPO-configurable registry field.
- Since a regular IPO account only reaches these checkboxes via **editing** an existing (usually scraped) event — not via create, since scrapers never fill out the form — a flag set that way only reaches the Secretariat via `ipo/publication-requests` (below), not `ipo/approvals` (which stays lighthouse-only/pending-only, a different concept).
- `createEvent` blocks an exact-match duplicate (same `ipo_id` + same `start_date` + same `title`, case-insensitive) with a friendly error before inserting — scoped to the submitter's own org only; the same title/date under a *different* `ipo_id` is intentionally allowed and handled by the separate Duplicates feature instead.

### `ipo/approvals`
- `can_approve`-gated (one-line redirect guard, `page.tsx`), scoped to `events` where `approval_status='pending'` **and** the org is `ipos.type='lighthouse'` — a regular IPO account's pending events (if any) never appear here. This is intentional/unchanged — it's an approve/reject queue for LHA calendar visibility, not a general triage list.
- Shows the three publication-preference flags (see `ipo/events` above) as small icons (`PublicationFlags` component, `components/events/PublicationFlags`) next to the "Pending" badge, only rendered when true — capturing the flags on the form is pointless if the reviewer can't see them here
- `approveEvent` (in `actions.ts`) is the only action — no reject, no detail expansion

### `ipo/publication-requests`
- `can_approve`-gated, same guard pattern. Unlike `ipo/approvals` (lighthouse-only, pending-only), this spans **every** org and **every** approval status — the actual fix for the gap noted in the `ipo/events` entry above, since a flagged scraped IPO event has nowhere else to surface for Secretariat review.
- Query: `events` where any of `wants_social_media`/`wants_website_article`/`wants_newsletter` is true (`.or(...)` filter, or a single `.eq()` when a channel filter narrows it to one), paginated (`PAGE_SIZE=25`)
- Filters: channel (`?channel=social|website|newsletter`) and org (`?ipo=<id>`), `PublicationRequestFiltersBar` mirrors `components/duplicates/DuplicateFiltersBar`
- **Read-only by design** — no "mark as handled" action, no new tracking columns; purely a visibility/triage list, consistent with the client's "not requesting automatic publication." A handled-workflow is a natural future add if requested, not built preemptively.
- Reuses the same `PublicationFlags` component as `ipo/approvals` (extracted to `components/events/PublicationFlags` rather than duplicated) — a row can appear on both pages simultaneously (e.g. a flagged, still-pending LHA event) and that overlap is expected, not a bug: the two pages answer different questions ("does this go on the calendar" vs "does this get communicated").

### `ipo/approvals`, `ipo/accounts`, `ipo/api-keys` (all `can_approve`-gated)
- Guard pattern: `if (!user?.app_metadata?.can_approve) redirect('/dashboard/ipo')` at the top of `page.tsx` — no shared layout-level check for this flag, each page repeats the one-liner (this is the precedent `ipo/duplicates` followed)
- `approvals`: `events` where `approval_status = 'pending'`, scoped to `ipos.type = 'lighthouse'` orgs; approve/reject writes `approval_status`
- `accounts`: manages LHA login credentials via `admin.auth.admin.listUsers()`, filtered to `role === 'ipo_user'` and a hardcoded `LIGHTHOUSE_IDS` list (`_components/LighthouseAccountsTable.tsx`) — not read from the `ipos` table
- `api-keys`: CRUD for `api_tokens`, scoped to `created_by = user.id`; powers the public `/api/v1/events` REST endpoint

## Adding a New Page

1. Create `app/dashboard/academy/newpage/page.tsx`
2. Add `export const dynamic = 'force-dynamic'` at the top
3. Create `loading.tsx` with a skeleton
4. Create `error.tsx` with `'use client'` (Next.js requires this)
5. If mutations needed, create `actions.ts` with `'use server'`
6. Add a nav link in `components/layout/AcademySidebar/index.tsx`
