'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { setAcademyStatus } from '@/lib/data/event-duplicates'

function revalidateDuplicateViews() {
  revalidatePath('/dashboard/academy/duplicates')
  revalidatePath('/dashboard/academy/gaps')
  revalidatePath('/dashboard/academy')
  revalidatePath('/dashboard/ipo/duplicates')
}

export async function linkDuplicate(formData: FormData) {
  const eventId            = formData.get('event_id') as string
  const duplicateOfEventId = formData.get('duplicate_of_event_id') as string
  if (!eventId || !duplicateOfEventId) return

  const supabase = createAdminClient()

  // Reconcile status once, at link time, in case either side was already
  // matched to the Academy catalogue before this link existed.
  const [{ data: a }, { data: b }] = await Promise.all([
    supabase.from('events').select('in_academy,academy_event_id').eq('id', eventId).single(),
    supabase.from('events').select('in_academy,academy_event_id').eq('id', duplicateOfEventId).single(),
  ])
  const inAcademy      = Boolean(a?.in_academy || b?.in_academy)
  const academyEventId = a?.academy_event_id ?? b?.academy_event_id ?? null

  await supabase.from('events').update({ duplicate_of_event_id: duplicateOfEventId }).eq('id', eventId)
  await setAcademyStatus(supabase, duplicateOfEventId, inAcademy, academyEventId)

  revalidateDuplicateViews()
}

export async function unlinkDuplicate(formData: FormData) {
  const eventId = formData.get('event_id') as string
  if (!eventId) return

  const supabase = createAdminClient()
  await supabase.from('events').update({ duplicate_of_event_id: null }).eq('id', eventId)

  revalidateDuplicateViews()
}

export async function dismissDuplicate(formData: FormData) {
  const eventId          = formData.get('event_id') as string
  const duplicateEventId = formData.get('duplicate_event_id') as string
  if (!eventId || !duplicateEventId) return

  const supabase = createAdminClient()
  await supabase
    .from('duplicate_dismissals')
    .upsert({ event_id: eventId, duplicate_event_id: duplicateEventId }, { onConflict: 'event_id,duplicate_event_id' })

  revalidateDuplicateViews()
}

export async function searchDuplicateCandidates(
  query: string,
  excludeEventId?: string,
  excludeIpoId?: string,
): Promise<{ id: string; ipo_id: string; title: string; start_date: string | null; status: string | null }[]> {
  if (!query.trim()) return []
  // Admin client — same reasoning as ipo/approvals: a plain org session's RLS
  // won't show other IPOs' events, and this needs to search across all of them.
  const supabase = createAdminClient()
  let queryBuilder = supabase
    .from('events')
    .select('id,ipo_id,title,start_date,status')
    .ilike('title', `%${query.trim()}%`)
    .is('duplicate_of_event_id', null)

  if (excludeEventId) queryBuilder = queryBuilder.neq('id', excludeEventId)
  if (excludeIpoId)   queryBuilder = queryBuilder.neq('ipo_id', excludeIpoId)

  const { data } = await queryBuilder
    .order('start_date', { ascending: false })
    .limit(10)
  return data ?? []
}
