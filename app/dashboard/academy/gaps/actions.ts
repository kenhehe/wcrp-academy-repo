'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function markInAcademy(formData: FormData) {
  const id = formData.get('id') as string
  if (!id) return

  const supabase = createAdminClient()
  await supabase.from('events').update({ in_academy: true }).eq('id', id)

  revalidatePath('/dashboard/academy/gaps')
  revalidatePath('/dashboard/academy')
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
  await supabase
    .from('events')
    .update({ in_academy: true, academy_event_id: academyEventId })
    .eq('id', eventId)

  revalidatePath('/dashboard/academy/gaps')
  revalidatePath('/dashboard/academy')
}
