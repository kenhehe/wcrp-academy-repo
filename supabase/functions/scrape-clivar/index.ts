import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parse } from 'npm:node-html-parser'
import type { ScrapedEvent } from '../_shared/types.ts'
import {
  computeStatus,
  dryRunEvents,
  fetchWithRetry,
  finishRun,
  isFreshScrape,
  parseDateRange,
  parseDate,
  peekFirstTitle,
  recordSkippedRun,
  scrapeOnePage,
  sleep,
  startRun,
  upsertEvents,
} from '../_shared/utils.ts'

const IPO_ID       = 'clivar'
const BASE         = 'https://www.clivar.org'
const LIST         = '/events'
// CLIVAR is a Drupal site — paginate with ?page=N (0-indexed)
const PAGE_DELAY   = 60_000   // 60 s to respect rate limit
const MAX_PAGES    = 30

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

  // Drupal Views event listing — common selectors
  const items = root.querySelectorAll(
    '.views-row, .view-content > article, .event-listing-item, .events-list-item, article.node--type-event',
  )
  for (const item of items) {
    const titleEl = item.querySelector('h2 a, h3 a, h4 a, .views-field-title a, .node__title a')
    const title   = titleEl?.text.trim()
    if (!title) continue

    const href     = titleEl?.getAttribute('href') ?? ''
    const eventUrl = href.startsWith('http') ? href : `${BASE}${href}`

    // Drupal date fields
    const startEl = item.querySelector(
      '.date-display-single, time[datetime], .views-field-field-event-date time, .field--name-field-date time',
    )
    const dateTxt = startEl?.getAttribute('datetime') ?? startEl?.text ?? ''

    const endEl = item.querySelector(
      '.date-display-end, .views-field-field-event-end-date time',
    )
    const endTxt = endEl?.getAttribute('datetime') ?? endEl?.text ?? ''

    // Try range string first, then individual start/end
    const combined = [dateTxt, endTxt].filter(Boolean).join(' - ')
    const { start, end } = parseDateRange(combined)
    const startDate = start ?? parseDate(dateTxt)
    if (!startDate) continue

    const locEl  = item.querySelector('.views-field-field-event-location, .field--name-field-location, .event-location')
    const locRaw = locEl?.text.trim() ?? ''
    const [location, country] = splitLocation(locRaw)

    events.push({
      ipo_id: IPO_ID, title, start_date: startDate, end_date: end ?? undefined,
      location, country, url: eventUrl, status: computeStatus(startDate, end ?? undefined),
      source: 'clivar.org', source_url: sourceUrl,
    })
  }
  if (events.length > 0) return events

  // Fallback: generic article list
  const articles = root.querySelectorAll('article, .node')
  for (const art of articles) {
    const titleEl = art.querySelector('h2 a, h3 a, .node-title a')
    const title   = titleEl?.text.trim()
    if (!title) continue

    const href     = titleEl?.getAttribute('href') ?? ''
    const eventUrl = href.startsWith('http') ? href : `${BASE}${href}`

    const timeEl  = art.querySelector('time[datetime]')
    const dateTxt = timeEl?.getAttribute('datetime') ?? timeEl?.text ?? ''
    const start   = parseDate(dateTxt)
    if (!start) continue

    events.push({
      ipo_id: IPO_ID, title, start_date: start,
      url: eventUrl, status: computeStatus(start),
      source: 'clivar.org', source_url: sourceUrl,
    })
  }
  return events
}

function hasNextPage(html: string): boolean {
  const root = parse(html)
  return !!(
    root.querySelector('li.pager__item--next a, .pager-next a, a[rel="next"], li.next a') ||
    root.querySelector('.pagination .next:not(.disabled)')
  )
}

async function scrapeAll(runId: string, supabase: unknown): Promise<ScrapedEvent[]> {
  const all: ScrapedEvent[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = page === 0 ? `${BASE}${LIST}` : `${BASE}${LIST}?page=${page}`
    console.log(`[clivar] fetching page ${page}: ${url}`)

    let res: Response
    try {
      res = await fetchWithRetry(url)
    } catch (e) {
      console.warn(`[clivar] page ${page} failed: ${e}`)
      break
    }

    const html   = await res.text()
    const events = parseEvents(html, url)
    console.log(`[clivar] page ${page}: found ${events.length} events`)

    if (events.length > 0) {
      all.push(...events)
      // Flush to DB every page so progress is saved even if we time out
      // deno-lint-ignore no-explicit-any
      await upsertEvents(supabase as any, events)
    }

    if (!hasNextPage(html)) break

    // Rate-limit delay between pages
    if (page < MAX_PAGES - 1) {
      console.log(`[clivar] sleeping ${PAGE_DELAY / 1000}s before next page…`)
      await sleep(PAGE_DELAY)
    }
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

  // Dry-run: page 1 only — CLIVAR's per-page delay makes full dry-run impractical
  if (body.dry_run) {
    try {
      const events  = await scrapeOnePage(`${BASE}${LIST}`, parseEvents)
      const preview = await dryRunEvents(supabase, IPO_ID, events)
      return Response.json({ dry_run: true, ipo: IPO_ID, note: 'Page 1 only', ...preview })
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 500 })
    }
  }

  const runId     = await startRun(supabase, IPO_ID, body.runId)
  const startedAt = new Date().toISOString()

  try {
    // CLIVAR has a 60s per-page delay — pre-check is especially valuable here
    if (!body.force) {
      const peekTitle = await peekFirstTitle(`${BASE}${LIST}`, parseEvents)
      if (peekTitle && await isFreshScrape(supabase, IPO_ID, peekTitle)) {
        console.log(`[${IPO_ID}] skipping — "${peekTitle}" already in DB`)
        await recordSkippedRun(supabase, runId, startedAt)
        return Response.json({ runId, skipped: true })
      }
    }

    const allEvents = await scrapeAll(runId, supabase)
    // Final upsert count — events were already flushed per-page above,
    // but we need accurate totals for the run record.
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
