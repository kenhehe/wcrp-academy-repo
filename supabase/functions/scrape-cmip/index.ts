import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parse } from 'npm:node-html-parser'
import type { ScrapedEvent } from '../_shared/types.ts'
import {
  computeStatus,
  dryRunEvents,
  fetchWithRetry,
  finishRun,
  isFreshScrape,
  parseDate,
  peekFirstTitle,
  recordSkippedRun,
  startRun,
  upsertEvents,
} from '../_shared/utils.ts'

const IPO_ID    = 'cmip'
const BASE      = 'https://wcrp-cmip.org'
const SEMINAR   = '/science-and-seminars/cmip-seminars/'
const SOURCE_URL = `${BASE}${SEMINAR}`

// The CMIP seminars page has a table of upcoming and past seminars.
// Each row: | Seminar # | Date | Speaker | Institution | Country | CMIP Phase |
// The title combines the session heading + talk sub-title.

function parseEvents(html: string): ScrapedEvent[] {
  const root   = parse(html)
  const events: ScrapedEvent[] = []

  // Try table rows — look for tables in the main content area
  const tables = root.querySelectorAll('table, .wp-block-table table')
  for (const table of tables) {
    const rows    = table.querySelectorAll('tr')
    if (rows.length < 2) continue

    // Detect column positions from header row
    const headers = rows[0].querySelectorAll('th, td').map(c => c.text.toLowerCase().trim())
    const col = {
      seminar:     findCol(headers, ['seminar', 'session', '#', 'series']),
      date:        findCol(headers, ['date']),
      title:       findCol(headers, ['title', 'talk', 'presentation']),
      speaker:     findCol(headers, ['speaker', 'presenter', 'name']),
      institution: findCol(headers, ['institution', 'affiliation', 'org']),
      country:     findCol(headers, ['country']),
      phase:       findCol(headers, ['cmip', 'phase', 'version']),
    }

    let lastSession = ''
    let lastDate    = ''

    for (const row of rows.slice(1)) {
      const cells = row.querySelectorAll('td')
      if (cells.length < 2) continue

      const get = (i: number) => (i >= 0 && i < cells.length ? cells[i].text.trim() : '')

      // Date — carry forward from rowspan cells
      const rawDate = get(col.date)
      if (rawDate) lastDate = rawDate
      const start   = parseDate(lastDate)
      if (!start) continue

      // Session name — carry forward from merged heading rows
      const rawSession = get(col.seminar)
      if (rawSession) lastSession = rawSession

      // Talk title
      const talkTitle = get(col.title)
      const title     = talkTitle
        ? `${lastSession}${lastSession ? ' - ' : ''}${talkTitle}`
        : lastSession || get(0)   // fallback: first cell text
      if (!title) continue

      const speaker     = get(col.speaker) || null
      const institution = get(col.institution) || null
      const country     = get(col.country) || null
      const cmip_phase  = get(col.phase) || null

      events.push({
        ipo_id: IPO_ID, title, start_date: start, end_date: start,
        speaker, institution, country, cmip_phase,
        url: SOURCE_URL, status: computeStatus(start),
        source: 'wcrp-cmip.org', source_url: SOURCE_URL,
      })
    }
    if (events.length > 0) return events   // stop at first matching table
  }

  // Fallback: scan for seminar headings + nested tables/lists
  // Section headings like "Seminar Series 2026 #5 — 29 July 2026"
  const headings = root.querySelectorAll('h2, h3, h4, strong')
  let currentSession = ''
  let currentDate    = ''

  for (const el of headings) {
    const text = el.text.trim()
    // Match "Seminar Series 2026 #5" or "CMIP Seminar #12"
    const sessionMatch = text.match(/seminar\s+series.*?#\d+|cmip\s+seminar\s+#?\d+/i)
    if (sessionMatch) {
      currentSession = text.replace(/\s*[-–—]\s*[\d\w\s,]+\d{4}.*/, '').trim()
      // Extract date from heading if present
      const dateMatch = text.match(/(\d{1,2}\s+\w+\s+\d{4}|\d{4}-\d{2}-\d{2})/)
      if (dateMatch) currentDate = dateMatch[0]
      continue
    }
    if (!currentSession) continue

    // Look for date-only headings near sessions
    const dateMatch = text.match(/^\s*(\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{1,2},?\s+\d{4})\s*$/)
    if (dateMatch) { currentDate = dateMatch[1]; continue }

    // Rows after session heading are individual talks
    if (currentDate && text.length > 10) {
      const start = parseDate(currentDate)
      if (start) {
        events.push({
          ipo_id: IPO_ID,
          title: `${currentSession} - ${text}`,
          start_date: start, end_date: start,
          url: SOURCE_URL, status: computeStatus(start),
          source: 'wcrp-cmip.org', source_url: SOURCE_URL,
        })
      }
    }
  }

  return events
}

function findCol(headers: string[], keywords: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    if (keywords.some(k => headers[i].includes(k))) return i
  }
  return -1
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

  // Dry-run: CMIP is a single page so we parse it all
  if (body.dry_run) {
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const enc    = new TextEncoder()
    const send   = (obj: object) => writer.write(enc.encode(JSON.stringify(obj) + '\n'))
    ;(async () => {
      try {
        await send({ stage: 0 })
        const res  = await fetchWithRetry(SOURCE_URL)
        await send({ stage: 1 })
        const html = await res.text()
        await send({ stage: 2 })
        const events = parseEvents(html)
        await send({ stage: 3 })
        const preview = await dryRunEvents(supabase, IPO_ID, events)
        await send({ done: true, ipo: IPO_ID, ...preview })
      } catch (err) {
        const msg = String(err)
        await send({
          error: (msg.includes('403') || msg.toLowerCase().includes('forbidden'))
            ? 'The CMIP website uses Cloudflare bot protection (HTTP 403). Automated scraping is blocked — add CMIP events manually through the Catalogue.'
            : msg,
        })
      } finally {
        await writer.close()
      }
    })()
    return new Response(readable, { headers: { 'Content-Type': 'application/x-ndjson' } })
  }

  const runId     = await startRun(supabase, IPO_ID, body.runId, body.source)
  const startedAt = new Date().toISOString()

  try {
    if (!body.force) {
      const peekTitle = await peekFirstTitle(SOURCE_URL, (html) => parseEvents(html))
      if (peekTitle && await isFreshScrape(supabase, IPO_ID, peekTitle)) {
        console.log(`[${IPO_ID}] skipping — "${peekTitle}" already in DB`)
        await recordSkippedRun(supabase, runId, startedAt)
        return Response.json({ runId, skipped: true })
      }
    }

    const res  = await fetchWithRetry(SOURCE_URL)
    const html = await res.text()
    const allEvents = parseEvents(html)

    const { inserted, updated, skippedInvalid, errors } = await upsertEvents(supabase, allEvents)
    await finishRun(supabase, runId, {
      status: errors.length > 0 ? 'partial' : 'success',
      eventsFound: allEvents.length, eventsNew: inserted,
      eventsUpdated: updated, errors, startedAt,
    })
    return Response.json({ runId, eventsFound: allEvents.length, inserted, updated, skippedInvalid, errors })
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    const msg = (raw.includes('403') || raw.toLowerCase().includes('forbidden'))
      ? 'Blocked by Cloudflare bot protection (HTTP 403). Add CMIP events manually.'
      : raw
    await finishRun(supabase, runId, {
      status: 'failed', eventsFound: 0, eventsNew: 0,
      eventsUpdated: 0, errors: [msg], startedAt,
    })
    return Response.json({ error: msg }, { status: 500 })
  }
})
