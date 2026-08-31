import type { SupabaseClient } from '@supabase/supabase-js'

// Updates in_academy/academy_event_id on an event AND keeps its whole
// duplicate cluster (canonical row + every row linked to it) in sync, so two
// events confirmed as the same real-world thing never disagree on coverage status.
export async function setAcademyStatus(
  supabase: SupabaseClient,
  eventId: string,
  inAcademy: boolean,
  academyEventId: string | null,
) {
  const { data: row } = await supabase
    .from('events')
    .select('duplicate_of_event_id')
    .eq('id', eventId)
    .single()

  const rootId = row?.duplicate_of_event_id ?? eventId

  await supabase
    .from('events')
    .update({ in_academy: inAcademy, academy_event_id: academyEventId })
    .or(`id.eq.${rootId},duplicate_of_event_id.eq.${rootId}`)
}
