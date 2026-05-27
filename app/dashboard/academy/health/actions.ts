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

export async function triggerScrape(ipoId: string, force = false): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const fnName = FUNCTION_MAP[ipoId]
  if (!fnName) throw new Error(`No scraper registered for IPO: ${ipoId}`)

  const { data: run, error: insertErr } = await supabase
    .from('scrape_runs')
    .insert({ ipo_id: ipoId, status: 'queued', started_at: new Date().toISOString() })
    .select('id')
    .single()

  if (insertErr) throw new Error(insertErr.message)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set')

  const edgeFnUrl  = `${supabaseUrl}/functions/v1/${fnName}`
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  fetch(edgeFnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${serviceKey}`,
    },
    // force=true bypasses the pre-check — useful for manual full re-scrape
    body: JSON.stringify({ runId: run.id, source: 'manual', force }),
  }).catch(err => console.error(`[triggerScrape] invoke ${fnName} failed:`, err))

  revalidatePath('/dashboard/academy/health')
}

export async function triggerAllScrapers(): Promise<{ fired: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) throw new Error('Missing Supabase env vars')

  const scrapers = Object.values(FUNCTION_MAP)
  for (const fnName of scrapers) {
    fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body:    JSON.stringify({ source: 'manual-all' }),
    }).catch(err => console.error(`[triggerAllScrapers] ${fnName} failed:`, err))
  }

  revalidatePath('/dashboard/academy/health')
  return { fired: scrapers.length }
}
