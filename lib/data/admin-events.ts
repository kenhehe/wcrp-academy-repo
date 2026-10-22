// Plain helpers (no 'use server') for the Academy / Secretariat event editor: add, edit and
// delete events for any IPO or Lighthouse programme. lib/actions/admin-events.ts wraps these
// with the role check and revalidation. Every function takes a service-role client.
import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminEventSource = 'academy' | 'secretariat'

// The fields an admin can set; an org's publication requests and custom fields stay the org's
export interface EventCoreInput {
  title:      string
  start_date: string
  end_date:   string | null
  status:     string
  location:   string | null
  country:    string | null
  url:        string | null
}

export interface SimilarEvent {
  org:   string
  title: string
}

const EDITABLE_ORG_TYPES = ['ipo', 'lighthouse']

// Sources an admin or org typed in by hand; anything else came from a scraper or import
export const HAND_ENTERED_SOURCES = ['manual', 'academy', 'secretariat']

function significantWords(title: string): Set<string> {
  return new Set(title.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(w => w.length > 3))
}

function looksAlike(a: string, b: string): boolean {
  const wa = significantWords(a)
  const wb = significantWords(b)
  const shared = [...wa].filter(w => wb.has(w)).length
  return shared / Math.max(1, Math.min(wa.size, wb.size)) >= 0.6
}

// Same start date, another org, a title sharing most of its words: likely the same real event
export async function findSimilarElsewhere(db: SupabaseClient, orgId: string, input: EventCoreInput): Promise<SimilarEvent[]> {
  const [{ data: sameDay, error }, { data: orgs, error: orgError }] = await Promise.all([
    db.from('events').select('ipo_id,title').eq('start_date', input.start_date).neq('ipo_id', orgId),
    db.from('ipos').select('id,name'),
  ])
  if (error)    throw new Error(`similar events query failed: ${error.message}`)
  if (orgError) throw new Error(`ipos query failed: ${orgError.message}`)
  const names = new Map((orgs ?? []).map(o => [o.id, o.name as string]))
  return (sameDay ?? [])
    .filter(e => looksAlike(e.title, input.title))
    .map(e => ({ org: names.get(e.ipo_id) ?? e.ipo_id, title: e.title }))
}

export async function insertEventForOrg(
  db: SupabaseClient,
  orgId: string,
  input: EventCoreInput,
  source: AdminEventSource,
): Promise<{ id: string; orgName: string; similar: SimilarEvent[] }> {
  const { data: org, error: orgError } = await db.from('ipos').select('id,name,type').eq('id', orgId).maybeSingle()
  if (orgError) throw new Error(`ipos query failed: ${orgError.message}`)
  if (!org || !EDITABLE_ORG_TYPES.includes(org.type)) throw new Error(`"${orgId}" is not an IPO or Lighthouse programme`)

  // Same exact-match rule as an org's own Add event: same org, same date, same title (any case)
  const { data: existing, error: existingError } = await db
    .from('events').select('id,title').eq('ipo_id', orgId).eq('start_date', input.start_date).ilike('title', input.title).limit(1)
  if (existingError) throw new Error(`duplicate check failed: ${existingError.message}`)
  if (existing && existing.length > 0) {
    throw new Error(`${org.name} already has an event with this title and date: "${existing[0].title}". Edit that one instead, or use a different title or date.`)
  }

  const { data: inserted, error } = await db
    .from('events')
    .insert({
      ipo_id:          orgId,
      ...input,
      source,
      approval_status: 'pending',   // waits in Approvals like every other new event
      extra_fields:    {},
    })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error(`${org.name} already has an event with this title and date.`)
    throw new Error(`insert failed: ${error.message}`)
  }

  return { id: inserted.id, orgName: org.name, similar: await findSimilarElsewhere(db, orgId, input) }
}

export async function updateEventCore(db: SupabaseClient, eventId: string, input: EventCoreInput): Promise<void> {
  const { data, error } = await db
    .from('events')
    .update({ ...input, last_seen_at: new Date().toISOString() })
    .eq('id', eventId)
    .select('id')
  if (error) {
    if (error.code === '23505') throw new Error('This organisation already has another event with this title and date.')
    throw new Error(`update failed: ${error.message}`)
  }
  if (!data || data.length === 0) throw new Error('That event no longer exists. Refresh the page.')
}

export async function deleteEventById(db: SupabaseClient, eventId: string): Promise<void> {
  const { data, error } = await db.from('events').delete().eq('id', eventId).select('id')
  if (error) throw new Error(`delete failed: ${error.message}`)
  if (!data || data.length === 0) throw new Error('That event no longer exists. Refresh the page.')
}
