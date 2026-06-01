import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parse } from 'npm:node-html-parser'
import type { ScrapedEvent } from '../_shared/types.ts'
import {
  computeStatus,

  fetchWithRetry,
  finishRun,
  isFreshScrape,
  parseDateRange,
  peekFirstTitle,
  recordSkippedRun,
  dryRunStream,
  startRun,
  upsertEvents,
} from '../_shared/utils.ts'

const IPO_ID = 'gewex'
const BASE   = 'https://www.gewexevents.org'
const LIST   = '/all-events/'

// Split "Montreal (McGill), Canada" → ["Montreal (McGill)", "Canada"]
function splitLocation(raw: string): [string | null, string | null] {
  const s = raw.trim()
  if (!s) return [null, null]
  const comma = s.lastIndexOf(',')
  if (comma === -1) return [s, null]
  return [s.slice(0, comma).trim(), s.slice(comma + 1).trim()]
}

function parseEvents(html: string, sourceUrl: string): ScrapedEvent[] {
  const root = parse(html)
  const events: ScrapedEvent[] = []

  // The Events Calendar (Tribe) list view
  const articles = root.querySelectorAll('article.tribe_events, article.type-tribe_events, .tribe-events-loop article')
  for (const art of articles) {
    const titleEl = art.querySelector('.tribe-events-list-event-title a, .tribe-event-url a, h2 a, h3 a')
    const title   = titleEl?.text.trim()
    if (!title) continue

    const href     = titleEl?.getAttribute('href') ?? ''
    const eventUrl = href.startsWith('http') ? href : `${BASE}${href}`

    const dateEl  = art.querySelector('.tribe-events-schedule abbr, .tribe-events-abbr, time')
    const dateTxt = dateEl?.getAttribute('title') ?? dateEl?.text ?? ''

    const venueEl = art.querySelector('.tribe-venue, .tribe-events-address')
    const locRaw  = venueEl?.text.trim() ?? ''
    const [location, country] = splitLocation(locRaw)

    const { start, end } = parseDateRange(dateTxt.replace(/@.*/g, '').trim())
    if (!start) continue

    events.push({
      ipo_id: IPO_ID, title, start_date: start, end_date: end,
      location, country, url: eventUrl, status: computeStatus(start, end),
      source: 'gewexevents.org', source_url: sourceUrl,
    })
  }
  if (events.length > 0) return events

  // Fallback: table rows (some pages use a simple table)
  const rows = root.querySelectorAll('table tr')
  for (const row of rows) {
    const cells = row.querySelectorAll('td')
    if (cells.length < 2) continue
    const link    = cells[0].querySelector('a')
    const title   = link?.text.trim() || cells[0].text.trim()
    if (!title) continue
    const href     = link?.getAttribute('href') ?? ''
    const eventUrl = href.startsWith('http') ? href : href ? `${BASE}${href}` : null
    const dateTxt  = cells[1].text.trim()
    const locRaw   = cells[2]?.text.trim() ?? ''
    const [location, country] = splitLocation(locRaw)
    const { start, end } = parseDateRange(dateTxt)
    if (!start) continue
    events.push({
      ipo_id: IPO_ID, title, start_date: start, end_date: end,
      location, country, url: eventUrl, status: computeStatus(start, end),
      source: 'gewexevents.org', source_url: sourceUrl,
    })
  }
  return events
}

async function scrapeSection(path: string): Promise<ScrapedEvent[]> {
  const all: ScrapedEvent[] = []
  for (let page = 1; page <= 60; page++) {
    const url = page === 1 ? `${BASE}${path}` : `${BASE}${path}page/${page}/`
    let res: Response
    try { res = await fetchWithRetry(url) } catch { break }
    const html   = await res.text()
    const events = parseEvents(html, url)
    if (events.length === 0) break
    all.push(...events)
    // Stop if no pagination link for next page
    const root = parse(html)
    const hasNext = root.querySelector('.next.page-numbers, a[rel="next"]')
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

  if (body.dry_run) return dryRunStream(supabase, IPO_ID, `${BASE}${LIST}`, parseEvents)

  const runId     = await startRun(supabase, IPO_ID, body.runId, body.source)
  const startedAt = new Date().toISOString()

  try {
    if (!body.force) {
      const peekTitle = await peekFirstTitle(`${BASE}${LIST}`, parseEvents)
      if (peekTitle && await isFreshScrape(supabase, IPO_ID, peekTitle)) {
        console.log(`[${IPO_ID}] skipping — "${peekTitle}" already in DB`)
        await recordSkippedRun(supabase, runId, startedAt)
        return Response.json({ runId, skipped: true })
      }
    }

    const allEvents = await scrapeSection(LIST)
    const { inserted, updated, skippedInvalid, errors } = await upsertEvents(supabase, allEvents)

    await finishRun(supabase, runId, {
      status: errors.length > 0 ? 'partial' : 'success',
      eventsFound: allEvents.length, eventsNew: inserted,
      eventsUpdated: updated, errors, startedAt,
    })
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
