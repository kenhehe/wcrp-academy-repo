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

const IPO_ID = 'cordex'
const BASE   = 'https://cordex.org'
const LIST   = '/news-events/meetings/'


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

  // Tribe Events Calendar list view
  const articles = root.querySelectorAll(
    'article.tribe_events, article.type-tribe_events, .tribe-events-loop article, .tribe-events-list__event',
  )
  for (const art of articles) {
    const titleEl = art.querySelector('.tribe-event-url a, .tribe-events-list-event-title a, h2 a, h3 a')
    const title   = titleEl?.text.trim()
    if (!title) continue

    const href     = titleEl?.getAttribute('href') ?? ''
    const eventUrl = href.startsWith('http') ? href : `${BASE}${href}`

    const dateTxt = art.querySelector('time, .tribe-events-schedule, .tribe-events-abbr')
      ?.getAttribute('datetime') ??
      art.querySelector('time, .tribe-events-schedule, .tribe-events-abbr')?.text ?? ''

    const locRaw = art.querySelector('.tribe-venue, .tribe-events-address, .tribe-venue-location')
      ?.text.trim() ?? ''
    const [location, country] = splitLocation(locRaw)

    const { start, end } = parseDateRange(dateTxt.replace(/@.*/g, '').trim())
    if (!start) continue

    events.push({
      ipo_id: IPO_ID, title, start_date: start, end_date: end,
      location, country, url: eventUrl, status: computeStatus(start, end),
      source: 'cordex.org', source_url: sourceUrl,
    })
  }
  if (events.length > 0) return events

  // CORDEX manually-maintained page: year headings (h2/h3) + <ul><li> items
  // Each li: "DD-DD Month: Title, Location (Country)"
  // Year is not inside each li — it comes from the nearest preceding heading.
  for (const heading of root.querySelectorAll('h2, h3')) {
    const yearText = heading.text.trim()
    if (!/^20\d{2}$/.test(yearText)) continue
    const year = yearText

    // Find the <ul> or <ol> that immediately follows this heading
    let sib = heading.nextElementSibling
    while (sib && !['ul', 'ol'].includes(sib.tagName.toLowerCase())) {
      if (['h2', 'h3'].includes(sib.tagName.toLowerCase())) break
      sib = sib.nextElementSibling
    }
    if (!sib) continue

    for (const li of sib.querySelectorAll('li')) {
      const text      = li.text.replace(/\s+/g, ' ').trim()
      const colonIdx  = text.indexOf(':')
      if (colonIdx === -1) continue

      const datePart  = text.slice(0, colonIdx).trim()
      const rest      = text.slice(colonIdx + 1).trim()
      if (!rest) continue

      // Split "Title, Location (Country)" on last ", Xxx (Yyy)" pattern
      const locMatch  = rest.match(/^(.*),\s*([^,(]+)\s*\(([^)]+)\)\s*$/)
      const title     = (locMatch ? locMatch[1] : rest).trim()
      const location  = locMatch ? locMatch[2].trim() : null
      const country   = locMatch ? locMatch[3].trim() : null
      if (!title) continue

      const link      = li.querySelector('a')
      const href      = link?.getAttribute('href') ?? ''
      const eventUrl  = href ? (href.startsWith('http') ? href : `${BASE}${href}`) : null

      const { start, end } = parseDateRange(`${datePart} ${year}`)
      if (!start) continue

      events.push({
        ipo_id: IPO_ID, title, start_date: start, end_date: end,
        location, country, url: eventUrl,
        status: computeStatus(start, end),
        source: 'cordex.org', source_url: sourceUrl,
      })
    }
  }
  return events
}

async function scrapeAll(): Promise<ScrapedEvent[]> {
  const all: ScrapedEvent[] = []
  for (let page = 1; page <= 60; page++) {
    const url  = page === 1 ? `${BASE}${LIST}` : `${BASE}${LIST}page/${page}/`
    let res: Response
    try { res = await fetchWithRetry(url) } catch { break }
    const html   = await res.text()
    const events = parseEvents(html, url)
    if (events.length === 0) break
    all.push(...events)
    const root    = parse(html)
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

  if (body.dry_run) return dryRunStream(supabase, IPO_ID, `${BASE}${LIST}`, parseEvents, 'Preview covers page 1 only — full run scrapes all pages and may find more events.')

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
