@AGENTS.md

# WCRP Academy Dashboard — Project Map

> Read README.md first for the full system explanation. This file is the quick-reference map for AI.

## What This Project Is

A Next.js 16 App Router dashboard for WCRP (World Climate Research Programme). It scrapes events from 7 IPO websites and audits their presence in the WCRP Academy training catalogue.

Two core data tables:
- `events` — every org's events: scraped from the IPO sites, plus Lighthouse events (a one-off import from wcrp-climate.org on 2026-10-22, then entered by hand); `source` says which (`manual`, `academy`, `secretariat`, `wcrp-climate.org`, or a scraper's site)
- `academy_events` — synced from WordPress (the Academy training catalogue)

Links:
- `events.academy_event_id` → `academy_events.id` (set when matched to the Academy catalogue)
- `events.duplicate_of_event_id` → `events.id` (set when two IPOs independently scraped the same real-world event — see `app/dashboard/academy/duplicates` / `app/dashboard/ipo/duplicates`). Both rows are kept for attribution; `in_academy`/`academy_event_id` stay in lockstep across a linked pair via `lib/data/event-duplicates.ts`'s `setAcademyStatus`.

**In progress (`feat/surveys`): pre/post surveys** that measure an event's impact. A survey attaches to one `academy_events` row (`survey_events.academy_event_id`); its tables all start with `survey_` and are service-role only (RLS on, no policies, privileges revoked from `anon`/`authenticated`). Plan, phases and decisions: `docs/surveys/PLAN.md`.

## Account Types & Access

Two disjoint account types, checked in each tree's root `layout.tsx` — a user is one or the other, never both:

- **`academy_admin`** (`user.app_metadata.role === 'academy_admin'`) — full access to `/dashboard/academy/*` (gate: `app/dashboard/academy/layout.tsx`). Has no `org_id`; cannot enter `/dashboard/ipo/*` at all.
- **IPO / Lighthouse org accounts** (`user.app_metadata.role === 'ipo_user'`, `org_id` set to an `ipos.id`) — access `/dashboard/ipo/*` (gate: `app/dashboard/ipo/layout.tsx`), normally scoped to their own `ipo_id` by RLS.
  - `ipos.type` is `'ipo'` (one of the 7 real IPOs), `'lighthouse'` (an LHA programme; the list comes from the `ipos` table via `getLighthouseOrgs()` in `lib/data/lighthouses.ts`, never a hardcoded id list), or `'secretariat'` (just one row today: `id='wcrp'`, the Climate/Secretariat account's own org — see migration `20260903_reclassify_wcrp_org_type.sql`; it used to be `type='ipo'`, which silently polluted every "7 IPOs" query written before that row existed). Type affects terminology/UI and org-filter grouping, not access level.
  - `user.app_metadata.can_approve` — an extra flag on select accounts (e.g. the Climate account, `org_id='wcrp'`) unlocking cross-org pages inside the `ipo/` tree: `approvals`, `event-registry`, `publication-requests`, `duplicates`, `accounts`, `api-keys`, plus the Climate Analytics view on the overview page. These pages use `createAdminClient()` for reads, since a plain org session's RLS won't show other orgs' data.
  - When writing a query meant to mean "the 7 real IPOs," `.eq('type', 'ipo')` is correct today (it now excludes `secretariat`) — but don't assume `type` only has two possible values; a query that means "every content-producing org" (not just IPOs) needs `type` unfiltered or explicitly listing `ipo`+`lighthouse`.

A feature that needs to reach both `academy_admin` and a `can_approve` IPO account (like Duplicates) can't live on one route — see `app/dashboard/CLAUDE.md`'s note on sharing components/actions across the two trees.

## Coding Rules

- **No barrel imports.** Always import from the exact file path.
- **No auto-format.** Preserve manual indentation.
- **Server Components by default.** Add `'use client'` only when the component needs hooks or browser events.
- **Two Supabase clients** — use the right one:
  - `createClient()` from `lib/supabase/server.ts` → reads the user session. Use for data fetching in Server Components.
  - `createAdminClient()` from `lib/supabase/admin.ts` → service role, bypasses RLS. Use for mutations in Server Actions ONLY. Never import in client components.
- **Mutations go in `actions.ts`** — always call `revalidatePath()` after mutating.
- **Every server action starts with a role guard** from `lib/auth/guards.ts` (`requireAcademyAdmin`, `requireCanApprove`, `requireAcademyAdminOrApprover`, or `requireUser` for org-scoped actions that then use the session's `org_id`). A server action is a public POST endpoint: gating the page that shows its button does not gate the action.
- **Org names:** `ipos.name` is the short label (an acronym: `CliC`, `DE`, `MCR`, `SLC`…) used in dropdowns, charts and tables; `ipos.full_name` is the long form, shown on hover or where there's room (`orgFullLabel()`). Every org dropdown groups IPOs / Lighthouse Activities / Secretariat with `groupOrgsByType()` from `lib/data/org-groups.ts` — don't hand-roll the grouping.
- **Never drop a query error.** Unwrap results with `must(label, result)` from `lib/supabase/must.ts` (or check `error` and throw) — a swallowed error renders as "no data" and hides the failure. The public API is the one place that turns errors into a 500 JSON response instead of throwing.
- **Any read that can return more than 1,000 rows goes through `fetchAllRows()`** (`lib/supabase/fetch-all.ts`), ordered by a unique column at the end. PostgREST cuts every response at 1,000 rows without an error; when the Lighthouse import took approved events past 1,000, the public homepage and API quietly lost every upcoming event.
- **Skeletons are mandatory** for dynamic data. Use `@/components/ui/skeleton`.
- **`cn()` for class merging.** No hardcoded hex colors — use CSS variables.
- **Theme colors are hex variables** (`app/globals.css`). Reference them as `var(--primary)`; for transparency use `color-mix(in oklab, var(--border) 30%, transparent)`. Never `hsl(var(--x))` — that's the old shadcn HSL-triplet convention, invalid with hex values, and the browser drops it silently (borders fall back to the text color, chart/SVG fills to black).
- **shadcn/ui here runs on Base UI, not Radix** (`components.json` style `base-nova`). Compose with the `render` prop (`<DialogClose render={<Button />}>`), not `asChild` — Radix-era snippets won't work as-is.
- **Status colors and page chrome:** use the tone tokens (`text-warning bg-warning-soft`, …) or `components/base/StatusBadge`, and `components/base/PageHeader` for page titles — never raw Tailwind palette classes, which break dark mode. Details: `app/dashboard/CLAUDE.md` → Theme, tokens & dark mode.
- **Type-check:** `npx tsc --noEmit` (there is no `npm run type-check`).

## Directory Map

```
app/dashboard/academy/
  health/       System Health — run scrapers, view logs
  events/       Academy Coverage — audit of academy_events vs IPO sources
  gaps/         Gap Analysis — IPO events not in Academy (in_academy=false)
  duplicates/   Cross-IPO Duplicates — same event scraped from two IPO sites (academy_admin)
  event-registry/ Searchable browse of every event across every org (IPO + LHA), plus add / edit / delete for any org
  catalogue/    Read-only live view of the WordPress catalogue (edit events on WordPress only)
  accounts/     User management
  import/       Sync / Export: WordPress sync status + "Sync now", CSV/Excel export of academy_events
  surveys/      Pre/post surveys on Academy events (Phases 1–7 built on feat/surveys) — see docs/surveys/PLAN.md

app/s/[slug]/[stage]/   Participant survey pages, no login (proxy.ts `isSurveyPublic`); app/s/[slug]/stop = stop reminders
app/api/surveys/cron/   Sends due survey emails; pg_cron calls it with a Bearer secret

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
  base/         Project atoms: PageHeader, PageInfo, StatusBadge, StatTile, OrgDot (see components/CLAUDE.md)
  layout/       AcademySidebar, IPOSidebar — both render into the shared SidebarDrawer
                (hamburger trigger + slide-in overlay, grouped nav sections); see app/dashboard/CLAUDE.md
  duplicates/   Shared Duplicates review UI — rendered from BOTH academy/ and ipo/ trees, see below
  charts/       Sparkline, MiniColumns, ChartBar, StatusDonut
  [feature]/    Domain components shared across pages — each is Component/index.tsx + types.ts

lib/
  supabase/server.ts    createClient() — server-side, reads cookie session
  supabase/admin.ts     createAdminClient() — service role, server-only
  supabase/client.ts    Browser Supabase client (for Realtime only)
  supabase/fetch-all.ts fetchAllRows() — pages past the 1,000-row cap
  supabase/must.ts      must() — unwraps a query result, throws on error
  auth/guards.ts        requireUser / requireAcademyAdmin / requireCanApprove / requireAcademyAdminOrApprover
  data/*.ts             Loaders and pure helpers (health, coverage, climate-analytics, event-trends, org-groups,
                        lighthouses, scrape-schedule…) — conventions in lib/CLAUDE.md
  data/academy-events.types.ts   AcademyEventRow interface, resolveStatus()
  data/event-duplicates.ts       Plain helper (no 'use server'): setAcademyStatus() keeps a duplicate pair's coverage status in sync
  actions/event-duplicates.ts    'use server': linkDuplicate, unlinkDuplicate, dismissDuplicate, searchDuplicateCandidates —
                                  shared across academy/duplicates and ipo/duplicates instead of a per-route actions.ts (see note below)
  data/admin-events.ts           Plain helpers: insert / update / delete any org's event (core fields + publication flags), similar-event lookup
  actions/admin-events.ts        'use server': createEventForOrg, updateAnyEvent, deleteAnyEvent — academy_admin or can_approve,
                                  shared across academy/event-registry and ipo/event-registry; new events start pending

supabase/functions/
  _shared/utils.ts      All scraper helpers: parseDateRange, upsertEvents, dryRunStream, etc.
  _shared/types.ts      ScrapedEvent and ScrapeResult interfaces
  scrape-*/index.ts     One scraper per IPO — see CLAUDE.md in this directory
  _shared/academy-dates.ts  The Academy date/status rule (WordPress 20270111 days, On demand = publish date only,
                        status from dates); also imported by the app. _shared/wp-text.ts decodes title entities
  sync-academy-wp/      Fetches WordPress catalogue, upserts into academy_events (daily pg_cron, 02:00 UTC)
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
npm test               # Vitest unit tests (lib/**/*.test.ts, supabase/functions/**/*.test.ts)
npx tsc --noEmit       # Type-check
npx shadcn@latest add [comp]   # Add shadcn component

# Supabase Edge Functions
supabase functions deploy scrape-gewex   # Deploy one scraper
supabase functions deploy sync-academy-wp
```

## IPO IDs (used as primary keys everywhere)

`gewex` | `cordex` | `esmo` | `rifs` | `cmip` | `clic` | `clivar`

To add a new scraper: see `supabase/functions/CLAUDE.md`.

## Folder guides

- `app/dashboard/CLAUDE.md` — every dashboard route, theme tokens, sharing features across the two trees
- `app/api/CLAUDE.md` — the public events API and the internal routes
- `components/CLAUDE.md` — ui vs base vs charts vs feature folders, Base UI gotchas
- `lib/CLAUDE.md` — data loaders, shared actions, query rules
- `supabase/functions/CLAUDE.md` — scrapers and their schedule
- `supabase/migrations/CLAUDE.md` — how schema and data changes get applied
- `docs/surveys/PLAN.md` — the survey module: decisions, data model, emails, phases and their status
