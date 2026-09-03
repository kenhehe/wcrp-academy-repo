@AGENTS.md

# WCRP Academy Dashboard — Project Map

> Read README.md first for the full system explanation. This file is the quick-reference map for AI.

## What This Project Is

A Next.js 15 App Router dashboard for WCRP (World Climate Research Programme). It scrapes events from 7 IPO websites and audits their presence in the WCRP Academy training catalogue.

Two core data tables:
- `events` — scraped IPO events (source of truth for what IPOs publish)
- `academy_events` — synced from WordPress (the Academy training catalogue)

Links:
- `events.academy_event_id` → `academy_events.id` (set when matched to the Academy catalogue)
- `events.duplicate_of_event_id` → `events.id` (set when two IPOs independently scraped the same real-world event — see `app/dashboard/academy/duplicates` / `app/dashboard/ipo/duplicates`). Both rows are kept for attribution; `in_academy`/`academy_event_id` stay in lockstep across a linked pair via `lib/data/event-duplicates.ts`'s `setAcademyStatus`.

## Account Types & Access

Two disjoint account types, checked in each tree's root `layout.tsx` — a user is one or the other, never both:

- **`academy_admin`** (`user.app_metadata.role === 'academy_admin'`) — full access to `/dashboard/academy/*` (gate: `app/dashboard/academy/layout.tsx`). Has no `org_id`; cannot enter `/dashboard/ipo/*` at all.
- **IPO / Lighthouse org accounts** (`user.app_metadata.role === 'ipo_user'`, `org_id` set to an `ipos.id`) — access `/dashboard/ipo/*` (gate: `app/dashboard/ipo/layout.tsx`), normally scoped to their own `ipo_id` by RLS.
  - `ipos.type` is `'ipo'` (one of the 7 real IPOs) or `'lighthouse'` (an LHA programme, hardcoded id list in `app/dashboard/ipo/accounts/page.tsx`) — affects terminology/UI, not access level.
  - `user.app_metadata.can_approve` — an extra flag on select IPO/lighthouse accounts (e.g. the Climate account) unlocking cross-org pages inside the `ipo/` tree: `approvals`, `accounts`, `api-keys`, `duplicates`, plus the Climate Analytics view on the overview page. These pages use `createAdminClient()` for reads, since a plain org session's RLS won't show other orgs' data.

A feature that needs to reach both `academy_admin` and a `can_approve` IPO account (like Duplicates) can't live on one route — see `app/dashboard/CLAUDE.md`'s note on sharing components/actions across the two trees.

## Coding Rules

- **No barrel imports.** Always import from the exact file path.
- **No auto-format.** Preserve manual indentation.
- **Server Components by default.** Add `'use client'` only when the component needs hooks or browser events.
- **Two Supabase clients** — use the right one:
  - `createClient()` from `lib/supabase/server.ts` → reads the user session. Use for data fetching in Server Components.
  - `createAdminClient()` from `lib/supabase/admin.ts` → service role, bypasses RLS. Use for mutations in Server Actions ONLY. Never import in client components.
- **Mutations go in `actions.ts`** — always call `revalidatePath()` after mutating.
- **Skeletons are mandatory** for dynamic data. Use `@/components/ui/skeleton`.
- **`cn()` for class merging.** No hardcoded hex colors — use CSS variables.
- **Type-check:** `npx tsc --noEmit` (there is no `npm run type-check`).

## Directory Map

```
app/dashboard/academy/
  health/       System Health — run scrapers, view logs
  events/       Academy Coverage — audit of academy_events vs IPO sources
  gaps/         Gap Analysis — IPO events not in Academy (in_academy=false)
  duplicates/   Cross-IPO Duplicates — same event scraped from two IPO sites (academy_admin)
  event-registry/ Read-only, searchable browse of every event across every org (IPO + LHA) — see note below
  catalogue/    CRUD editor for academy_events table
  accounts/     User management
  import/       Bulk CSV import

app/dashboard/ipo/
  events/                 Browse all scraped IPO events; Add/Edit modal has publication-preference checkboxes
  event-registry/         Same Event Registry feature as above, gated by can_approve instead of academy_admin
  duplicates/             Same Duplicates feature as above, gated by can_approve instead of academy_admin
  approvals/              Approve pending events for the public calendar/API (can_approve) — covers every org, not just LHA; display/copy is LHA-flavored but not functionally scoped that way
  publication-requests/   Every event flagged for social/website/newsletter, any org, any status (can_approve)
  accounts/               Manage LHA programme login credentials (can_approve)
  api-keys/               Manage public API tokens for the events REST API (can_approve)
  import/                 Bulk import for IPO events

components/
  ui/           shadcn/ui — CLI-managed, do NOT edit manually
  base/         Project wrappers (PageInfo)
  duplicates/   Shared Duplicates review UI — rendered from BOTH academy/ and ipo/ trees, see below
  [feature]/    Domain components shared across pages — each is Component/index.tsx + types.ts

lib/
  supabase/server.ts    createClient() — server-side, reads cookie session
  supabase/admin.ts     createAdminClient() — service role, server-only
  supabase/client.ts    Browser Supabase client (for Realtime only)
  data/academy-events.types.ts   AcademyEventRow interface, resolveStatus()
  data/event-duplicates.ts       Plain helper (no 'use server'): setAcademyStatus() keeps a duplicate pair's coverage status in sync
  actions/event-duplicates.ts    'use server': linkDuplicate, unlinkDuplicate, dismissDuplicate, searchDuplicateCandidates —
                                  shared across academy/duplicates and ipo/duplicates instead of a per-route actions.ts (see note below)

supabase/functions/
  _shared/utils.ts      All scraper helpers: parseDateRange, upsertEvents, dryRunStream, etc.
  _shared/types.ts      ScrapedEvent and ScrapeResult interfaces
  scrape-*/index.ts     One scraper per IPO — see CLAUDE.md in this directory
  sync-academy-wp/      Fetches WordPress catalogue, upserts into academy_events
```

## Standard Page Pattern

Every route follows this structure:
```
page.tsx          Server Component — fetches data, renders shell
actions.ts        Server Actions ('use server') — all DB mutations
loading.tsx       Skeleton shown while page.tsx loads
error.tsx         Error boundary ('use client')
_components/      Private components for this route only
```

## Key Patterns to Know

**Server Action + revalidate:**
```typescript
// actions.ts
'use server'
export async function doThing(formData: FormData) {
  const db = createAdminClient()
  await db.from('table').update(...).eq('id', formData.get('id'))
  revalidatePath('/dashboard/academy/gaps')
}
```

**Client component calling a Server Action:**
```typescript
'use client'
import { useTransition } from 'react'
import { doThing } from '../actions'

export default function MyButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()
  return (
    <button onClick={() => startTransition(async () => {
      const fd = new FormData()
      fd.append('id', id)
      await doThing(fd)
    })}>
      {isPending ? 'Loading…' : 'Do thing'}
    </button>
  )
}
```

**Supabase data fetch in Server Component:**
```typescript
const supabase = await createClient()
const { data, count } = await supabase
  .from('events')
  .select('id,title', { count: 'exact' })
  .eq('in_academy', false)
  .range(0, 24)
```

## Commands

```bash
npm run dev            # Start dev server
npm run lint           # ESLint
npx tsc --noEmit       # Type-check
npx shadcn@latest add [comp]   # Add shadcn component

# Supabase Edge Functions
supabase functions deploy scrape-gewex   # Deploy one scraper
supabase functions deploy sync-academy-wp
```

## IPO IDs (used as primary keys everywhere)

`gewex` | `cordex` | `esmo` | `rifs` | `cmip` | `clic` | `clivar`

To add a new scraper: see `supabase/functions/CLAUDE.md`.
