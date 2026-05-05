import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parse } from 'npm:node-html-parser'
import type { ScrapedEvent } from '../_shared/types.ts'
import {
  computeStatus,
  fetchWithRetry,
  finishRun,
  parseDateRange,
  startRun,
  upsertEvents,
} from '../_shared/utils.ts'

const IPO_ID = 'rifs'
const BASE   = 'https://www.wcrp-rifs.org'
const LIST   = '/news-and-events/workshops/'

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

  // Try Tribe Events Calendar first
  const articles = root.querySelectorAll(
    'article.tribe_events, article.type-tribe_events, .tribe-events-loop article',
  )
  for (const art of articles) {
    const titleEl = art.querySelector('.tribe-event-url a, .tribe-events-list-event-title a, h2 a, h3 a')
    const title   = titleEl?.text.trim()
    if (!title) continue
    const href     = titleEl?.getAttribute('href') ?? ''
    const eventUrl = href.startsWith('http') ? href : `${BASE}${href}`
    const dateTxt  = art.querySelector('time, .tribe-events-schedule, .tribe-events-abbr')?.text ?? ''
    const locRaw   = art.querySelector('.tribe-venue, .tribe-events-address')?.text.trim() ?? ''
    const [location, country] = splitLocation(locRaw)
    const { start, end } = parseDateRange(dateTxt.replace(/@.*/g, '').trim())
    if (!start) continue
    events.push({
      ipo_id: IPO_ID, title, start_date: start, end_date: end,
      location, country, url: eventUrl, status: computeStatus(start, end),
      source: 'wcrp-rifs.org', source_url: sourceUrl,
    })
  }
  if (events.length > 0) return events

  // Fallback: generic article/post list (WordPress)
  const posts = root.querySelectorAll('article, .post, .workshop-item, .entry')
  for (const post of posts) {
    const titleEl = post.querySelector('h2 a, h3 a, h4 a, .entry-title a')
    const title   = titleEl?.text.trim()
    if (!title) continue
    const href     = titleEl?.getAttribute('href') ?? ''
    const eventUrl = href.startsWith('http') ? href : href ? `${BASE}${href}` : null

    // Try to find a date in text — look for date patterns
    const text = post.text
    const dateMatch = text.match(
      /(\d{1,2}[\s–-]+\d{1,2}\s+\w+\s+\d{4}|\d{1,2}\s+\w+\s*[-–]\s*\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{1,2}[-–]\d{1,2},?\s+\d{4}|\d{1,2}\s+\w+\s+\d{4})/,
    )
    if (!dateMatch) continue
    const { start, end } = parseDateRange(dateMatch[0])
    if (!start) continue

    // Look for location near "Location:", "Venue:", city mentions
    const locMatch = text.match(/[Ll]ocation:\s*([^\n|]+)/)
    const locRaw   = locMatch ? locMatch[1].trim() : ''
    const [location, country] = splitLocation(locRaw)

    events.push({
      ipo_id: IPO_ID, title, start_date: start, end_date: end,
      location, country, url: eventUrl, status: computeStatus(start, end),
      source: 'wcrp-rifs.org', source_url: sourceUrl,
    })
  }
  return events
}

async function scrapeAll(): Promise<ScrapedEvent[]> {
  const all: ScrapedEvent[] = []
  for (let page = 1; page <= 20; page++) {
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

  const body      = await req.json().catch(() => ({}))
  const runId     = await startRun(supabase, IPO_ID, body.runId)
  const startedAt = new Date().toISOString()

  try {
    const allEvents = await scrapeAll()
    const { inserted, updated, errors } = await upsertEvents(supabase, allEvents)

    await finishRun(supabase, runId, {
      status: errors.length > 0 ? 'partial' : 'success',
      eventsFound: allEvents.length, eventsNew: inserted,
      eventsUpdated: updated, errors, startedAt,
    })
    return Response.json({ runId, eventsFound: allEvents.length, inserted, updated, errors })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await finishRun(supabase, runId, {
      status: 'failed', eventsFound: 0, eventsNew: 0,
      eventsUpdated: 0, errors: [msg], startedAt,
    })
    return Response.json({ error: msg }, { status: 500 })
  }
})
