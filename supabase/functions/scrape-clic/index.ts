import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { ScrapedEvent } from '../_shared/types.ts'
import {
  computeStatus,
  dryRunStream,
  finishRun,
  isFreshScrape,
  peekFirstTitle,
  recordSkippedRun,
  startRun,
  upsertEvents,
} from '../_shared/utils.ts'

const IPO_ID    = 'clic'
const WIDGET_ID = 'f76aa094-ea91-4569-8a98-d3a9ead275ce'
const API_URL   = `https://core.service.elfsight.com/p/boot/?page=https://climate-cryosphere.org/events/&w=${WIDGET_ID}`

interface ElfsightEvent {
  id:           string
  name:         string
  start:        { date: string; time?: string }
  end:          { date: string; time?: string }
  buttonLink?:  { value?: string }
  description?: string
}

// The "json" parameter receives the raw JSON string from the Elfsight API
function parseEvents(json: string, sourceUrl: string): ScrapedEvent[] {
  const events: ScrapedEvent[] = []
  try {
    const data       = JSON.parse(json)
    const widgetData = data?.data?.widgets?.[WIDGET_ID]?.data?.settings?.events as ElfsightEvent[]
    if (!Array.isArray(widgetData)) return events

    for (const ev of widgetData) {
      const title      = ev.name?.trim()
      const start_date = ev.start?.date
      const end_date   = ev.end?.date ?? null
      const url        = ev.buttonLink?.value ?? null

      if (!title || !start_date) continue

      events.push({
        ipo_id: IPO_ID, title, start_date, end_date, url,
        status: computeStatus(start_date, end_date ?? undefined),
        source: 'climate-cryosphere.org', source_url: sourceUrl,
      })
    }
  } catch (err) {
    console.error('[clic] JSON parse error:', err)
  }
  return events
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

  if (body.dry_run) return dryRunStream(supabase, IPO_ID, API_URL, parseEvents)

  const runId     = await startRun(supabase, IPO_ID, body.runId, body.source)
  const startedAt = new Date().toISOString()

  try {
    if (!body.force) {
      const peekTitle = await peekFirstTitle(API_URL, parseEvents)
      if (peekTitle && await isFreshScrape(supabase, IPO_ID, peekTitle)) {
        console.log(`[${IPO_ID}] skipping — "${peekTitle}" already in DB`)
        await recordSkippedRun(supabase, runId, startedAt)
        return Response.json({ runId, skipped: true })
      }
    }

    const res       = await fetch(API_URL)
    const json      = await res.text()
    const allEvents = parseEvents(json, API_URL)

    const { inserted, updated, skippedInvalid, errors } = await upsertEvents(supabase, allEvents)

    await finishRun(supabase, runId, {
      status:        errors.length > 0 ? 'partial' : 'success',
      eventsFound:   allEvents.length, eventsNew: inserted,
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
