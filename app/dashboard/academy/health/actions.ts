'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const FUNCTION_MAP: Record<string, string> = {
  gewex:  'scrape-gewex',
  cordex: 'scrape-cordex',
  esmo:   'scrape-esmo',
  rifs:   'scrape-rifs',
  cmip:   'scrape-cmip',
  clic:   'scrape-clic',
  clivar: 'scrape-clivar',
}

export async function triggerScrape(_: FormData, ipoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'academy_admin') {
    throw new Error('Unauthorized')
  }

  const fnName = FUNCTION_MAP[ipoId]
  if (!fnName) throw new Error(`No scraper registered for IPO: ${ipoId}`)

  // Create a queued run record — the Edge Function will flip it to 'running'
  const { data: run, error: insertErr } = await supabase
    .from('scrape_runs')
    .insert({ ipo_id: ipoId, status: 'queued', started_at: new Date().toISOString() })
    .select('id')
    .single()

  if (insertErr) throw new Error(insertErr.message)

  // Fire-and-forget: invoke the Edge Function asynchronously so the UI
  // isn't blocked. The function updates scrape_runs when it finishes.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set')

  const edgeFnUrl  = `${supabaseUrl}/functions/v1/${fnName}`
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Non-blocking invoke — we don't await the response body
  fetch(edgeFnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ runId: run.id }),
  }).catch(err => console.error(`[triggerScrape] invoke ${fnName} failed:`, err))

  revalidatePath('/dashboard/academy/health')
}
