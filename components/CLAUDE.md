# components/ — shared UI

Route-private components live in that route's `_components/`; this folder is for anything used by more than one route (or both dashboard trees). Each component is `Name/index.tsx` + `types.ts` (except `ui/`).

## Folders

- **`ui/`** — shadcn/ui, CLI-managed (`npx shadcn@latest add …`). Don't edit by hand. Style is `base-nova`, built on **Base UI, not Radix**.
- **`base/`** — project atoms every page uses:
  - `PageHeader` — eyebrow, title, `PageInfo` popover, description, actions. Every dashboard page starts with it.
  - `StatusBadge` — `tone` (neutral/info/success/warning/danger/primary) + icon + label. Status is never colour alone.
  - `StatTile` — label / value / sub, plus optional `change` (green up, red down, with arrows; build it with `describeChange()`) and `aside` (a sparkline, mini columns or a button).
  - `OrgDot` — an org's identity colour (`ipos.color_hex`) with a ring for dark mode.
- **`charts/`** — `Sparkline`, `MiniColumns` (server-safe SVG/divs), `ChartBar`, `StatusDonut` (Recharts; the donut is due for a redesign). Colours come from tokens; org colours only from `ipos.color_hex`.
- **`layout/`** — `SidebarDrawer` (shared top bar + slide-in drawer), `AcademySidebar`, `IPOSidebar`, `ThemeToggle`.
- **Feature folders** — `events/` (EventForm, EventsTable, Event Registry browser/filters, AdminEventDialogs, PublicationFlags), `duplicates/`, `calendar/` (public homepage calendar), `health/` (StatusStrip), `gaps/`, `ipo/`, `academy/`, `accounts/`, `import/`, `auth/`, `surveys/` (SurveyShell and SurveyQuestions: the participant survey card and question renderer, used by both the public pages and the admin preview; LocalDateTime; TimeZoneNote).

## Base UI gotchas

- Compose with the `render` prop (`<DialogClose render={<Button />}>`), not `asChild`.
- A link styled as a button is `<Link className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>`.
- **`Select` shows the raw value in its trigger unless you pass `items`** (`items={{ all: 'All organisations', esmo: 'ESMO' }}`). Any select whose value differs from its label needs it — the homepage calendar showed "all" until it got one.
- Org selects group with `SelectGroup`/`SelectLabel` via `groupOrgsByType()` (`lib/data/org-groups.ts`), with `title={orgFullLabel(org)}` on each item.

## Styling

- Colours are CSS variables from `app/globals.css` (`bg-canvas` page ground, `bg-card` surfaces, tone tokens like `text-warning bg-warning-soft`). No hex values, no raw Tailwind palette classes — details in `app/dashboard/CLAUDE.md` → Theme, tokens & dark mode.
- **A Server Component can render a component from a `'use client'` file, but can't read its other exports.** A constant or function exported next to a client component is a client reference on the server: reading it (`SURVEY_TABS.find(…)`) throws at render, which the build doesn't catch. Put values both sides need in a plain module (e.g. `academy/surveys/[slug]/_components/tabs.ts`).
- `'use client'` only when the component needs state, effects or browser events; derive values during render instead of syncing them with `setState` inside an effect (lint rejects that).
- Every dynamic block gets a matching skeleton from `@/components/ui/skeleton`.
