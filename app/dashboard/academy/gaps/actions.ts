'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { setAcademyStatus } from '@/lib/data/event-duplicates'

export async function markInAcademy(formData: FormData) {
  const id = formData.get('id') as string
  if (!id) return

  const supabase = createAdminClient()
  await setAcademyStatus(supabase, id, true, null)

  revalidatePath('/dashboard/academy/gaps')
  revalidatePath('/dashboard/academy')
}

// Awaits the sync response (unlike scraper triggers which fire-and-forget).
// Safe to await here — sync-academy-wp is fast (WP API fetch + DB upsert, ~3–10s).
export async function triggerAcademySync(): Promise<{ ok: boolean; message: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return { ok: false, message: 'Missing Supabase env vars' }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/sync-academy-wp`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
    })
    const json = await res.json() as { message?: string; synced?: number; error?: string }
    if (!res.ok) return { ok: false, message: json.error ?? `HTTP ${res.status}` }
    return { ok: true, message: `Synced ${json.synced ?? 0} events from Academy` }
  } catch (err) {
    return { ok: false, message: String(err) }
  }
}

export async function searchAcademyEvents(query: string): Promise<{ id: string; title: string; start_date: string | null; status: string | null }[]> {
  if (!query.trim()) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('academy_events')
    .select('id,title,start_date,status')
    .ilike('title', `%${query.trim()}%`)
    .order('start_date', { ascending: false })
    .limit(10)
  return data ?? []
}

export async function confirmMatch(formData: FormData) {
  const eventId        = formData.get('event_id')        as string
  const academyEventId = formData.get('academy_event_id') as string
  if (!eventId || !academyEventId) return

  const supabase = createAdminClient()
  await setAcademyStatus(supabase, eventId, true, academyEventId)

  revalidatePath('/dashboard/academy/gaps')
  revalidatePath('/dashboard/academy')
}
