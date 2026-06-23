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
- Source: `events` table where `in_academy = false`
- Fuzzy suggestions come from `find_fuzzy_matches` PostgreSQL RPC (`pg_trgm`)
- Threshold: 0.35 (raised from 0.15 to reduce noise)
- Rows sorted by fuzzy score descending (high confidence first)
- Three actions: "Yes same event" (writes `academy_event_id`), "Already in Academy" (sets `in_academy=true`), "Link manually" (ManualMatchDialog)
- `ManualMatchDialog`: searches `academy_events` table locally; if no results, offers "Sync from Academy" button that calls `sync-academy-wp` edge function

### `academy/catalogue`
- Full CRUD for `academy_events`
- `AcademyEventForm` is a large form component — edit it in `_components/AcademyEventForm.tsx`
- Uses `AcademyEventInput` type from `lib/data/academy-events.types.ts`

### `ipo/events`
- Source: `events` table (all 7 IPOs combined)
- Filter by ipo_id, status, year via URL params

## Adding a New Page

1. Create `app/dashboard/academy/newpage/page.tsx`
2. Add `export const dynamic = 'force-dynamic'` at the top
3. Create `loading.tsx` with a skeleton
4. Create `error.tsx` with `'use client'` (Next.js requires this)
5. If mutations needed, create `actions.ts` with `'use server'`
6. Add a nav link in `components/layout/AcademySidebar/index.tsx`
