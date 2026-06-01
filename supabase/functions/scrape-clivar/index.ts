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


function parseEvents(html: string, sourceUrl: string): ScrapedEvent[] {
  const root   = parse(html)
  const events: ScrapedEvent[] = []

  // CLIVAR table: columns are Event Dates | City | Country | Event (link) | External URL
  // No CSS classes — match any table row that has a link to /events/[slug]
  for (const row of root.querySelectorAll('tr')) {
    const cells = row.querySelectorAll('td')
    if (cells.length < 4) continue

    const link  = cells[3].querySelector('a[href*="/events/"]')
    const title = (link?.text ?? cells[3].text).trim()
    if (!title) continue

    const href     = link?.getAttribute('href') ?? ''
    const eventUrl = href.startsWith('http') ? href : href ? `${BASE}${href}` : null

    const dateTxt  = cells[0].text.trim()
    const { start, end } = parseDateRange(dateTxt)
    if (!start) continue

    const city    = cells[1].text.trim() || null
    const country = cells[2].text.trim() || null

    events.push({
      ipo_id: IPO_ID, title, start_date: start, end_date: end,
      location: city, country, url: eventUrl,
      status: computeStatus(start, end ?? undefined),
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
  if (body.dry_run) return dryRunStream(supabase, IPO_ID, `${BASE}${LIST}`, parseEvents, 'Page 1 only')

  const runId     = await startRun(supabase, IPO_ID, body.runId, body.source)
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
