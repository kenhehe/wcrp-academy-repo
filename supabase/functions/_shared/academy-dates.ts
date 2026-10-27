// The Academy catalogue's date and status rule, shared by the WordPress sync (Deno) and the
// app (lib/wordpress/mapper.ts, lib/data/academy-events.types.ts). Plain TypeScript with no
// imports so both runtimes can load it; tests in academy-dates.test.ts.
//
// WordPress (ACF date fields) sends days as '20270111'. An On demand record keeps only its
// publish date; every other record's status comes from its start and end dates, so a tag
// set by hand on WordPress can't go stale.

export const ACADEMY_STATUSES = ['Upcoming training', 'Ongoing training', 'Past training', 'On Demand'] as const
export type AcademyStatus = typeof ACADEMY_STATUSES[number]

// WordPress event_status slugs → labels
const TAG_LABELS: Record<string, AcademyStatus> = {
  upcoming_training:  'Upcoming training',
  ongoing_training:   'Ongoing training',
  on_going_training:  'Ongoing training',
  past_training:      'Past training',
  on_demand_training: 'On Demand',
  on_demand:          'On Demand',
}

// '20270111' or '2027-01-11' → '2027-01-11'; empty, malformed or impossible days → null
export function parseAcademyDay(value: unknown): string | null {
  const digits = String(value ?? '').trim().replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1$2$3')
  if (!/^\d{8}$/.test(digits)) return null
  const day = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
  const d = new Date(`${day}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day ? day : null
}

// A WordPress tag slug ('on_going_training') or a stored label ('Ongoing training') → the label;
// null when it's neither
export function academyTagLabel(tag: unknown): AcademyStatus | null {
  const s = String(tag ?? '').trim()
  if ((ACADEMY_STATUSES as readonly string[]).includes(s)) return s as AcademyStatus
  return TAG_LABELS[s.toLowerCase().replace(/[\s-]+/g, '_')] ?? null
}

// Past when the last day is before today, Upcoming when the first day is after it, otherwise
// Ongoing (today included). A missing end counts as a one-day event; no dates at all → null.
export function statusFromDays(start: string | null, end: string | null, today: string): AcademyStatus | null {
  const first = start ?? end
  const last  = end ?? start
  if (!first || !last) return null
  if (last < today)  return 'Past training'
  if (first > today) return 'Upcoming training'
  return 'Ongoing training'
}

export interface AcademyDates {
  status:       AcademyStatus | null   // null: no dates and no known tag
  start_date:   string | null
  end_date:     string | null
  publish_date: string | null
}

// The dates a record keeps and the status they give on `today` ('YYYY-MM-DD', UTC).
// On demand: the publish date only, start and end are dropped. Otherwise the dates decide;
// with no start or end, a publish date alone still means On demand, else the tag stands.
export function resolveAcademyDates(
  raw: { tag: unknown; start: unknown; end: unknown; publish: unknown },
  today: string,
): AcademyDates {
  const tag     = academyTagLabel(raw.tag)
  const publish = parseAcademyDay(raw.publish)
  if (tag === 'On Demand') return { status: 'On Demand', start_date: null, end_date: null, publish_date: publish }

  const start = parseAcademyDay(raw.start)
  const end   = parseAcademyDay(raw.end)
  const status = statusFromDays(start, end, today) ?? (publish ? 'On Demand' : tag)
  return { status, start_date: start, end_date: end, publish_date: publish }
}

// Today's day in UTC, the same clock as the IPO events' nightly status update
export function utcToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}
