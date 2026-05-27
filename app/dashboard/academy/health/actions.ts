'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

async function assertAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return user
}

export async function triggerScrape(ipoId: string, force = false): Promise<void> {
  await assertAuth()

  const fnName = FUNCTION_MAP[ipoId]
  if (!fnName) throw new Error(`No scraper registered for IPO: ${ipoId}`)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) throw new Error('Missing Supabase env vars')

  // Use admin client so the INSERT bypasses RLS (service_role policy)
  const db = createAdminClient()
  const { data: run, error: insertErr } = await db
    .from('scrape_runs')
    .insert({ ipo_id: ipoId, status: 'queued', started_at: new Date().toISOString(), source: 'manual' })
    .select('id')
    .single()

  if (insertErr) throw new Error(insertErr.message)

  fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ runId: run.id, source: 'manual', force }),
  }).catch(err => console.error(`[triggerScrape] invoke ${fnName} failed:`, err))

  revalidatePath('/dashboard/academy/health')
}

export async function triggerAllScrapers(): Promise<{ fired: number }> {
  await assertAuth()

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
