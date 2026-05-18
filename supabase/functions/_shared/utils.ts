import type { ScrapedEvent } from './types.ts'

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
  jan: '01', feb: '02', mar: '03', apr: '04',
  jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

export function parseDate(input: string | null | undefined): string | null {
  if (!input) return null
  const s = input.trim().replace(/\s+/g, ' ')

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // "25 November 2026" | "25 Nov 2026"
  const dmy = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/)
  if (dmy) {
    const m = MONTHS[dmy[2].toLowerCase()]
    if (m) return `${dmy[3]}-${m}-${dmy[1].padStart(2, '0')}`
  }

  // "November 25, 2026" | "Nov 25, 2026" | "November 25 2026"
  const mdy = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/)
  if (mdy) {
    const m = MONTHS[mdy[1].toLowerCase()]
    if (m) return `${mdy[3]}-${m}-${mdy[2].padStart(2, '0')}`
  }

  // "25/11/2026" or "25-11-2026"
  const dmy2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy2) return `${dmy2[3]}-${dmy2[2].padStart(2, '0')}-${dmy2[1].padStart(2, '0')}`

  // "2026/11/25"
  const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`

  // Fallback: native Date parse (handles many formats)
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]

  return null
}

// Parse a date range string like "15-18 September 2024" or "15 Sep – 3 Oct 2024"
export function parseDateRange(raw: string): { start: string | null; end: string | null } {
  const s = raw.trim().replace(/–|—/g, '-') // em/en dash → hyphen

  // "15-18 September 2024"
  const sameMonth = s.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/)
  if (sameMonth) {
    const m = MONTHS[sameMonth[3].toLowerCase()]
    if (m) return {
      start: `${sameMonth[4]}-${m}-${sameMonth[1].padStart(2, '0')}`,
      end:   `${sameMonth[4]}-${m}-${sameMonth[2].padStart(2, '0')}`,
    }
  }

  // "15 Sep - 3 Oct 2024"
  const crossMonth = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s*[-–]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/)
  if (crossMonth) {
    const m1 = MONTHS[crossMonth[2].toLowerCase()]
    const m2 = MONTHS[crossMonth[4].toLowerCase()]
    if (m1 && m2) return {
      start: `${crossMonth[5]}-${m1}-${crossMonth[1].padStart(2, '0')}`,
      end:   `${crossMonth[5]}-${m2}-${crossMonth[3].padStart(2, '0')}`,
    }
  }

  // Single date
  const single = parseDate(s)
  return { start: single, end: single }
}

export function computeStatus(
  startDate: string,
  endDate?: string | null,
): 'Upcoming' | 'Ongoing' | 'Past' {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = new Date(startDate)
  const end   = endDate ? new Date(endDate) : start
  if (end < today)   return 'Past'
  if (start > today) return 'Upcoming'
  return 'Ongoing'
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function fetchWithRetry(
  url: string,
  opts: RequestInit = {},
  maxRetries = 3,
  baseDelayMs = 2000,
): Promise<Response> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; WCRP-Events-Bot/1.0; +https://wcrp-events.org)',
    Accept: 'text/html,application/xhtml+xml',
    ...opts.headers,
  }
  let last: Error = new Error('Unknown error')
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, { ...opts, headers })
      if (res.status === 429) {
        const wait = parseInt(res.headers.get('Retry-After') ?? '60') * 1000
        console.warn(`[429] Rate limited on ${url}, waiting ${wait}ms`)
        await sleep(wait)
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`)
      return res
    } catch (e) {
      last = e as Error
      console.warn(`[fetchWithRetry] attempt ${i + 1}/${maxRetries} failed: ${last.message}`)
      await sleep(baseDelayMs * Math.pow(2, i))
    }
  }
  throw last
}

// ---------------------------------------------------------------------------
// Supabase upsert
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
export async function upsertEvents(supabase: any, events: ScrapedEvent[]): Promise<{ inserted: number; updated: number; errors: string[] }> {
  if (events.length === 0) return { inserted: 0, updated: 0, errors: [] }

  const errors: string[] = []
  let inserted = 0
  let updated  = 0

  // Batch in chunks of 100
  for (let i = 0; i < events.length; i += 100) {
    const chunk = events.slice(i, i + 100)
    const { data, error } = await supabase
      .from('events')
      .upsert(chunk, {
        onConflict:        'ipo_id,start_date,title',
        ignoreDuplicates:  false,
      })
      .select('id, created_at, updated_at')

    if (error) {
      errors.push(error.message)
      continue
    }

    const now = new Date().toISOString().slice(0, 19)
    for (const row of (data ?? [])) {
      // created_at === updated_at means it was just inserted
      if (row.created_at?.slice(0, 19) === now) inserted++
      else updated++
    }
  }

  return { inserted, updated, errors }
}

// ---------------------------------------------------------------------------
// Scrape run helpers
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
export async function startRun(supabase: any, ipoId: string, runId?: string): Promise<string> {
  if (runId) {
    await supabase.from('scrape_runs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', runId)
    return runId
  }
  const { data } = await supabase
    .from('scrape_runs')
    .insert({ ipo_id: ipoId, status: 'running', started_at: new Date().toISOString() })
    .select('id')
    .single()
  return data.id as string
}

// deno-lint-ignore no-explicit-any
export async function finishRun(supabase: any, runId: string, result: {
  status: 'success' | 'failed' | 'partial' | 'skipped'
  eventsFound: number
  eventsNew: number
  eventsUpdated: number
  errors: string[]
  startedAt: string
}) {
  const finishedAt = new Date().toISOString()
  const durationMs = new Date(finishedAt).getTime() - new Date(result.startedAt).getTime()
  await supabase.from('scrape_runs').update({
    status:         result.status,
    finished_at:    finishedAt,
    duration_ms:    durationMs,
    events_found:   result.eventsFound,
    events_new:     result.eventsNew,
    events_updated: result.eventsUpdated,
    errors:         result.errors.length > 0 ? result.errors : null,
    error_message:  result.errors[0] ?? null,
  }).eq('id', runId)
}

// ---------------------------------------------------------------------------
// Freshness pre-check — skip scrape if site hasn't changed
// ---------------------------------------------------------------------------

// Fetches page-1 of a listing URL, runs the parser, returns the first event title.
// Returns null on any error so callers always proceed when uncertain.
export async function peekFirstTitle(
  url: string,
  parser: (html: string, sourceUrl: string) => { title: string }[],
): Promise<string | null> {
  try {
    const res    = await fetchWithRetry(url)
    const html   = await res.text()
    const events = parser(html, url)
    return events[0]?.title?.trim() ?? null
  } catch {
    return null
  }
}

// Returns true when peekTitle already exists in the events table — safe to skip.
// deno-lint-ignore no-explicit-any
export async function isFreshScrape(supabase: any, ipoId: string, peekTitle: string): Promise<boolean> {
  const { data } = await supabase
    .from('events')
    .select('id')
    .eq('ipo_id', ipoId)
    .ilike('title', peekTitle)
    .limit(1)
  return (data?.length ?? 0) > 0
}

// Closes a run record as 'skipped' without touching the events table.
// deno-lint-ignore no-explicit-any
export async function recordSkippedRun(supabase: any, runId: string, startedAt: string): Promise<void> {
  const finishedAt = new Date().toISOString()
  await supabase.from('scrape_runs').update({
    status:         'skipped',
    finished_at:    finishedAt,
    duration_ms:    new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
    events_found:   0,
    events_new:     0,
    events_updated: 0,
    error_message:  null,
    errors:         null,
  }).eq('id', runId)
}
