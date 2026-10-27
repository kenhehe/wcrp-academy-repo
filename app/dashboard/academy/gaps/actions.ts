'use server'

import { must } from '@/lib/supabase/must'
import { requireAcademyAdmin } from '@/lib/auth/guards'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { setAcademyStatus } from '@/lib/data/event-duplicates'

export async function markInAcademy(formData: FormData) {
  await requireAcademyAdmin()
  const id = formData.get('id') as string
  if (!id) return

  const supabase = createAdminClient()
  await setAcademyStatus(supabase, id, true, null)

  revalidatePath('/dashboard/academy/gaps')
  revalidatePath('/dashboard/academy')
}

export async function searchAcademyEvents(query: string): Promise<{ id: string; title: string; start_date: string | null; status: string | null }[]> {
  await requireAcademyAdmin()
  if (!query.trim()) return []
  const supabase = await createClient()
  const data = must('catalogue search', await supabase
    .from('academy_events')
    .select('id,title,start_date,status')
    .ilike('title', `%${query.trim()}%`)
    .order('start_date', { ascending: false })
    .limit(10))
  return data ?? []
}

export async function confirmMatch(formData: FormData) {
  await requireAcademyAdmin()
  const eventId        = formData.get('event_id')        as string
  const academyEventId = formData.get('academy_event_id') as string
  if (!eventId || !academyEventId) return

  const supabase = createAdminClient()
  await setAcademyStatus(supabase, eventId, true, academyEventId)

  revalidatePath('/dashboard/academy/gaps')
  revalidatePath('/dashboard/academy')
}
