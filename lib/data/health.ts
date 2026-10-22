import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'

export type DayStatus  = 'found' | 'same' | 'stuck' | 'failed' | 'none'
export type RunOutcome = 'found' | 'same' | 'stuck' | 'failed' | 'queued' | 'running'
export type LogFilter  = 'all' | 'failed' | 'unfinished' | 'manual'

export interface ScrapeRun {
  id:            string
  ipo_id:        string
  started_at:    string
  finished_at:   string | null
  status:        string
  events_found:  number | null
  events_new:    number | null
  error_message: string | null
  source:        string | null
}

export interface HealthIpo {
  id:        string
  name:      string
  color_hex: string | null
}

export interface StripDay {
  date:   string      // YYYY-MM-DD, UTC
  status: DayStatus
  title:  string      // native tooltip, e.g. "Tue 21 Oct: Failed"
}

export interface IpoHealthRow {
  ipo:             HealthIpo
  latestOutcome:   RunOutcome | null
  strip:           StripDay[]
  stripLabel:      string
  lastSuccessDate: string | null
  lastSuccessNote: string
}

export interface AttentionItem {
  ipo:     HealthIpo
  message: string
  href:    string | null
}

export interface HealthKpis {
  healthy:       number
  total:         number
  runs7d:        number
  failed7d:      number
  stuck7d:       number
  newEvents:     number
  lastNewEvents: string | null
}

export const DAY_STATUS_LABEL: Record<DayStatus, string> = {
  found:  'Found events',
  same:   'No change',
  stuck:  "Didn't finish",
  failed: 'Failed',
  none:   'No run',
}

export const HISTORY_DAYS  = 60
export const LOG_PAGE_SIZE = 10
export const LOG_FILTERS: LogFilter[] = ['all', 'failed', 'unfinished', 'manual']

const DAY_MS               = 86_400_000
const STUCK_AFTER_MS       = 15 * 60_000       // Edge Functions are killed long before this
const NOT_RUNNING_AFTER_MS = 26 * 3_600_000    // two missed twice-daily slots
const RUN_COLUMNS          = 'id,ipo_id,started_at,finished_at,status,events_found,events_new,error_message,source'
const DAY_RANK: Record<DayStatus, number> = { failed: 4, stuck: 3, found: 2, same: 1, none: 0 }

const UTC_DAY  = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
const UTC_DATE = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })
const UTC_TIME = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export function formatUtcDate(iso: string): string {
  return UTC_DATE.format(new Date(iso))
}

export function formatUtcDateTime(iso: string): string {
  const date = new Date(iso)
  return `${UTC_DATE.format(date)} ${UTC_TIME.format(date)}`
}

export function formatDuration(run: ScrapeRun): string {
  if (!run.finished_at) return '–'
  const ms = Date.parse(run.finished_at) - Date.parse(run.started_at)
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

export function parseLogFilter(value: string | undefined): LogFilter {
  return LOG_FILTERS.find(filter => filter === value) ?? 'all'
}

export function runOutcome(run: ScrapeRun, now: number): RunOutcome {
  switch (run.status) {
    case 'failed':  return 'failed'
    case 'success':
    case 'partial': return 'found'
    case 'skipped': return 'same'
    case 'queued':
    case 'running':
      if (now - Date.parse(run.started_at) > STUCK_AFTER_MS) return 'stuck'
      return run.status === 'queued' ? 'queued' : 'running'
    default:
      throw new Error(`Unknown scrape_runs status "${run.status}" on run ${run.id}`)
  }
}

export function runDetails(run: ScrapeRun, now: number): string {
  switch (runOutcome(run, now)) {
    case 'failed':  return run.error_message ?? 'Failed without an error message'
    case 'stuck':   return 'Started but never recorded a result'
    case 'queued':  return 'Waiting to start'
    case 'running': return 'In progress'
    case 'same':    return 'Nothing new: the first listed event is already saved'
    case 'found':   return `Found ${run.events_found ?? 0} events, ${run.events_new ?? 0} new`
  }
}

function startOfUtcDay(t: number): number {
  return Math.floor(t / DAY_MS) * DAY_MS
}

function asSentence(text: string): string {
  const trimmed = text.trim()
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

// One status per UTC day; the worst run of the day wins.
function buildStrip(runs: ScrapeRun[], now: number): StripDay[] {
  const byDay = new Map<string, DayStatus>()
  for (const run of runs) {
    const outcome = runOutcome(run, now)
    if (outcome === 'queued' || outcome === 'running') continue
    const date = run.started_at.slice(0, 10)
    const prev = byDay.get(date)
    if (!prev || DAY_RANK[outcome] > DAY_RANK[prev]) byDay.set(date, outcome)
  }

  const today = startOfUtcDay(now)
  return Array.from({ length: HISTORY_DAYS }, (_, i) => {
    const t      = today - (HISTORY_DAYS - 1 - i) * DAY_MS
    const date   = new Date(t).toISOString().slice(0, 10)
    const status = byDay.get(date) ?? 'none'
    return { date, status, title: `${UTC_DAY.format(t)}: ${DAY_STATUS_LABEL[status]}` }
  })
}

function stripLabel(name: string, strip: StripDay[]): string {
  const counts = new Map<DayStatus, number>()
  for (const day of strip) counts.set(day.status, (counts.get(day.status) ?? 0) + 1)
  const order: DayStatus[] = ['failed', 'stuck', 'found', 'same', 'none']
  const parts = order
    .filter(status => counts.has(status))
    .map(status => {
      const days = counts.get(status) ?? 0
      return `${DAY_STATUS_LABEL[status].toLowerCase()} on ${days} ${days === 1 ? 'day' : 'days'}`
    })
  return `${name}, last ${HISTORY_DAYS} days: ${parts.join(', ')}`
}

function successNote(run: ScrapeRun | null): string {
  if (!run) return 'No successful run'
  const added = run.events_new ?? 0
  return added > 0 ? `${added} new event${added === 1 ? '' : 's'}` : `${run.events_found ?? 0} found, 0 new`
}

// `runs` is this IPO's history window, newest first.
function attentionFor(ipo: HealthIpo, runs: ScrapeRun[], latest: ScrapeRun | null, now: number): AttentionItem | null {
  const sentences: string[] = []
  let href: string | null = null

  if (!latest || now - Date.parse(latest.started_at) > NOT_RUNNING_AFTER_MS) {
    sentences.push(latest
      ? `No runs since ${formatUtcDate(latest.started_at)}; check its scheduled job.`
      : 'No runs recorded; check its scheduled job.')
  }

  const finished = runs.filter(run => ['failed', 'same', 'found'].includes(runOutcome(run, now)))
  if (finished[0]?.status === 'failed') {
    let streak = 0
    while (streak < finished.length && finished[streak].status === 'failed') streak++
    const since = formatUtcDate(finished[streak - 1].started_at)
    const lead =
      streak === 1               ? 'Its last run failed'
      : streak === finished.length ? `Every run has failed since ${since} or earlier`
      : `Its last ${streak} runs failed, since ${since}`
    sentences.push(asSentence(`${lead}: ${finished[0].error_message ?? 'no error message'}`))
    href = '?result=failed#run-log'
  }

  const recent = runs.filter(run => now - Date.parse(run.started_at) <= 14 * DAY_MS)
  const stuck  = recent.filter(run => runOutcome(run, now) === 'stuck').length
  if (stuck >= 3) {
    sentences.push(`${stuck} of ${recent.length} runs in the last 14 days started but never finished.`)
    href ??= '?result=unfinished#run-log'
  }

  return sentences.length > 0 ? { ipo, message: sentences.join(' '), href } : null
}

export const getHealthOverview = cache(async () => {
  const db    = createAdminClient()
  const now   = Date.now()
  const since = new Date(startOfUtcDay(now) - (HISTORY_DAYS - 1) * DAY_MS).toISOString()

  const [iposRes, runsRes, lastNewRes] = await Promise.all([
    db.from('ipos').select('id,name,color_hex').eq('type', 'ipo').order('name'),
    db.from('scrape_runs').select(RUN_COLUMNS, { count: 'exact' }).gte('started_at', since).order('started_at', { ascending: false }),
    db.from('scrape_runs').select('ipo_id,started_at,events_new').gt('events_new', 0).order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (iposRes.error)    throw new Error(`ipos query failed: ${iposRes.error.message}`)
  if (runsRes.error)    throw new Error(`scrape_runs history query failed: ${runsRes.error.message}`)
  if (lastNewRes.error) throw new Error(`scrape_runs last-new-events query failed: ${lastNewRes.error.message}`)

  const runs = (runsRes.data ?? []) as ScrapeRun[]
  if (runsRes.count !== null && runs.length < runsRes.count) {
    throw new Error(`Run history truncated: got ${runs.length} of ${runsRes.count} rows (API row cap); paginate this query`)
  }

  const ipos = (iposRes.data ?? []) as HealthIpo[]
  const perIpo = await Promise.all(ipos.map(async ipo => {
    const [latestRes, successRes] = await Promise.all([
      db.from('scrape_runs').select(RUN_COLUMNS).eq('ipo_id', ipo.id)
        .order('started_at', { ascending: false }).limit(1).maybeSingle(),
      db.from('scrape_runs').select(RUN_COLUMNS).eq('ipo_id', ipo.id).in('status', ['success', 'partial'])
        .order('started_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (latestRes.error)  throw new Error(`latest run query failed for ${ipo.id}: ${latestRes.error.message}`)
    if (successRes.error) throw new Error(`last success query failed for ${ipo.id}: ${successRes.error.message}`)
    return { ipo, latest: latestRes.data as ScrapeRun | null, lastSuccess: successRes.data as ScrapeRun | null }
  }))

  const rows: IpoHealthRow[]       = []
  const attention: AttentionItem[] = []
  for (const { ipo, latest, lastSuccess } of perIpo) {
    const mine  = runs.filter(run => run.ipo_id === ipo.id)
    const strip = buildStrip(mine, now)
    rows.push({
      ipo,
      latestOutcome:   latest ? runOutcome(latest, now) : null,
      strip,
      stripLabel:      stripLabel(ipo.name, strip),
      lastSuccessDate: lastSuccess ? formatUtcDate(lastSuccess.started_at) : null,
      lastSuccessNote: successNote(lastSuccess),
    })
    const item = attentionFor(ipo, mine, latest, now)
    if (item) attention.push(item)
  }

  const week    = runs.filter(run => now - Date.parse(run.started_at) <= 7 * DAY_MS)
  const lastNew = lastNewRes.data as { ipo_id: string; started_at: string; events_new: number } | null
  const kpis: HealthKpis = {
    healthy:       ipos.length - attention.length,
    total:         ipos.length,
    runs7d:        week.length,
    failed7d:      week.filter(run => runOutcome(run, now) === 'failed').length,
    stuck7d:       week.filter(run => runOutcome(run, now) === 'stuck').length,
    newEvents:     runs.reduce((sum, run) => sum + (run.events_new ?? 0), 0),
    lastNewEvents: lastNew
      ? `${ipos.find(ipo => ipo.id === lastNew.ipo_id)?.name ?? lastNew.ipo_id}, ${formatUtcDate(lastNew.started_at)}`
      : null,
  }

  const firstDay = rows[0]?.strip[0]?.date
  const lastDay  = rows[0]?.strip[HISTORY_DAYS - 1]?.date
  return {
    now,
    rows,
    attention,
    kpis,
    windowLabel: firstDay && lastDay ? `${formatUtcDate(firstDay)} to ${formatUtcDate(lastDay)}` : '',
  }
})

export const getRunLog = cache(async (filter: LogFilter, page: number) => {
  const db          = createAdminClient()
  const now         = Date.now()
  const stuckBefore = new Date(now - STUCK_AFTER_MS).toISOString()

  const query = (f: LogFilter, head: boolean) => {
    const q = db.from('scrape_runs').select(RUN_COLUMNS, { count: 'exact', head })
    if (f === 'failed')     return q.eq('status', 'failed')
    if (f === 'unfinished') return q.in('status', ['queued', 'running']).lt('started_at', stuckBefore)
    if (f === 'manual')     return q.eq('source', 'manual')
    return q
  }

  const from = (page - 1) * LOG_PAGE_SIZE
  const [rowsRes, countRes] = await Promise.all([
    query(filter, false).order('started_at', { ascending: false }).range(from, from + LOG_PAGE_SIZE - 1),
    Promise.all(LOG_FILTERS.map(f => query(f, true))),
  ])
  if (rowsRes.error) throw new Error(`run log query failed: ${rowsRes.error.message}`)
  const counts = {} as Record<LogFilter, number>
  countRes.forEach((res, i) => {
    if (res.error) throw new Error(`run count query failed (${LOG_FILTERS[i]}): ${res.error.message}`)
    counts[LOG_FILTERS[i]] = res.count ?? 0
  })

  return { now, rows: (rowsRes.data ?? []) as ScrapeRun[], counts }
})
