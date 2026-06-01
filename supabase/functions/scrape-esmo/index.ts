import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parse } from 'npm:node-html-parser'
import type { ScrapedEvent } from '../_shared/types.ts'
import {

  dryRunStream,
  computeStatus,
  fetchWithRetry,
  finishRun,
  isFreshScrape,
  parseDateRange,
  peekFirstTitle,
  recordSkippedRun,
  startRun,
  upsertEvents,
} from '../_shared/utils.ts'

const IPO_ID   = 'esmo'
const BASE     = 'https://www.wcrp-esmo.org'
const CALENDAR = '/calendar'

function splitLocation(raw: string): [string | null, string | null] {
  const s = raw.trim()
  if (!s) return [null, null]
  const comma = s.lastIndexOf(',')
  if (comma === -1) return [s, null]
  return [s.slice(0, comma).trim(), s.slice(comma + 1).trim()]
}

function parseEvents(html: string, sourceUrl: string): ScrapedEvent[] {
  const root   = parse(html)
  const events: ScrapedEvent[] = []

  // The Events Calendar (Tribe) — month/list view
  const articles = root.querySelectorAll(
    'article.tribe_events, article.type-tribe_events, .tribe-events-list__event, .tribe-events-loop article',
  )
  for (const art of articles) {
    const titleEl = art.querySelector('.tribe-event-url a, .tribe-events-list-event-title a, h2 a, h3 a')
    const title   = titleEl?.text.trim()
    if (!title) continue

    const href     = titleEl?.getAttribute('href') ?? ''
    const eventUrl = href.startsWith('http') ? href : `${BASE}${href}`

    // Date: try <time datetime="..."> first, then text content
    const timeEl  = art.querySelector('time[datetime]')
    const dateTxt = timeEl?.getAttribute('datetime') ??
      art.querySelector('.tribe-events-schedule, .tribe-events-abbr, .tribe-event-date-start')?.text ?? ''

    const locRaw = art.querySelector('.tribe-venue, .tribe-events-address, .tribe-venue-location')
      ?.text.trim() ?? ''
    const [location, country] = splitLocation(locRaw)

    const { start, end } = parseDateRange(dateTxt.replace(/@.*/g, '').trim())
    if (!start) continue

    events.push({
      ipo_id: IPO_ID, title, start_date: start, end_date: end,
      location, country, url: eventUrl, status: computeStatus(start, end),
      source: 'wcrp-esmo.org', source_url: sourceUrl,
    })
  }
  if (events.length > 0) return events

  // Plone CMS fallback: event links are at /calendar/[slug]
  // Dates stored as ISO 8601 in title/datetime attributes of abbr or time elements
  const seen = new Set<string>()
  for (const link of root.querySelectorAll('a[href*="/calendar/"]')) {
    const href = link.getAttribute('href') ?? ''
    if (!/\/calendar\/\w/.test(href)) continue   // skip the listing page itself
    const title = link.text.trim()
    if (!title || title.length < 3) continue
    const url = href.startsWith('http') ? href : `${BASE}${href}`
    if (seen.has(url)) continue
    seen.add(url)

    let startDate: string | null = null
    let endDate:   string | null = null

    // Walk up the DOM tree looking for ISO datetime attributes
    // deno-lint-ignore no-explicit-any
    let node: any = link
    for (let i = 0; i < 6; i++) {
      node = node.parentNode
      if (!node) break
      const isoDates: string[] = []
      for (const el of node.querySelectorAll('[title],[datetime]')) {
        const val = (el.getAttribute('title') ?? el.getAttribute('datetime') ?? '').trim()
        if (/^\d{4}-\d{2}-\d{2}T/.test(val)) isoDates.push(val.slice(0, 10))
      }
      if (isoDates.length > 0) {
        startDate = isoDates[0]
        endDate   = isoDates.length > 1 ? isoDates[isoDates.length - 1] : null
        break
      }
    }

    // Text fallback — handles "Jul 06, 2026 to Jul 09, 2026"
    if (!startDate) {
      const txt = (link.parentNode?.parentNode?.text ?? link.parentNode?.text ?? '').trim()
      const { start, end } = parseDateRange(txt.replace(/\s+/g, ' ').slice(0, 120))
      startDate = start; endDate = end
    }

    if (!startDate) continue
    events.push({
      ipo_id: IPO_ID, title, start_date: startDate, end_date: endDate,
      url, status: computeStatus(startDate, endDate ?? undefined),
      source: 'wcrp-esmo.org', source_url: sourceUrl,
    })
  }
  return events
}

async function scrapeAll(): Promise<ScrapedEvent[]> {
  const all: ScrapedEvent[] = []
  // Scrape list view — try both /calendar and paginated versions
  for (let page = 1; page <= 30; page++) {
    const url  = page === 1
      ? `${BASE}${CALENDAR}`
      : `${BASE}${CALENDAR}/page/${page}/`
    let res: Response
    try { res = await fetchWithRetry(url) } catch { break }
    const html   = await res.text()
    const events = parseEvents(html, url)
    if (events.length === 0) break
    all.push(...events)
    const root    = parse(html)
    const hasNext = root.querySelector('.next.page-numbers, a[rel="next"], .tribe-events-nav-next a')
    if (!hasNext) break
  }
  return all
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const body = await req.json().catch(() => ({}))

  if (body.dry_run) return dryRunStream(supabase, IPO_ID, `${BASE}${CALENDAR}`, parseEvents)

  const runId     = await startRun(supabase, IPO_ID, body.runId, body.source)
  const startedAt = new Date().toISOString()

  try {
    if (!body.force) {
      const peekTitle = await peekFirstTitle(`${BASE}${CALENDAR}`, parseEvents)
      if (peekTitle && await isFreshScrape(supabase, IPO_ID, peekTitle)) {
        console.log(`[${IPO_ID}] skipping — "${peekTitle}" already in DB`)
        await recordSkippedRun(supabase, runId, startedAt)
        return Response.json({ runId, skipped: true })
      }
    }

    const allEvents = await scrapeAll()
    const { inserted, updated, skippedInvalid, errors } = await upsertEvents(supabase, allEvents)

    await finishRun(supabase, runId, {
      status: errors.length > 0 ? 'partial' : 'success',
      eventsFound: allEvents.length, eventsNew: inserted,
      eventsUpdated: updated, errors, startedAt,
    }, IPO_ID)
    return Response.json({ runId, eventsFound: allEvents.length, inserted, updated, skippedInvalid, errors })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await finishRun(supabase, runId, {
      status: 'failed', eventsFound: 0, eventsNew: 0,
      eventsUpdated: 0, errors: [msg], startedAt,
    })
    return Response.json({ error: msg }, { status: 500 })
  }
})
