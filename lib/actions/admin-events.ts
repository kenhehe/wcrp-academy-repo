'use server'

// Add / edit / delete any org's events, for academy_admin and can_approve accounts. Shared by
// app/dashboard/academy/event-registry and app/dashboard/ipo/event-registry (one feature,
// two trees), so it lives here instead of a per-route actions.ts.
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  deleteEventById,
  insertEventForOrg,
  updateEventCore,
  type AdminEventSource,
  type EventCoreInput,
  type SimilarEvent,
} from '@/lib/data/admin-events'
import { STATUS_OPTIONS } from '@/components/events/EventForm/types'

async function assertEventAdmin(): Promise<AdminEventSource> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  if (user.app_metadata?.role === 'academy_admin') return 'academy'
  if (user.app_metadata?.can_approve === true)    return 'secretariat'
  throw new Error('Not allowed: only the Academy team and the Secretariat can change other organisations’ events')
}

function text(formData: FormData, key: string): string | null {
  const value = formData.get(key)
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseCore(formData: FormData): EventCoreInput {
  const title      = text(formData, 'title')
  const start_date = text(formData, 'start_date')
  const status     = text(formData, 'status')
  if (!title)      throw new Error('Title is required')
  if (!start_date) throw new Error('Start date is required')
  if (!status || !(STATUS_OPTIONS as readonly string[]).includes(status)) throw new Error('Pick a status')
  const end_date = text(formData, 'end_date')
  if (end_date && end_date < start_date) throw new Error('The end date is before the start date')
  return {
    title,
    start_date,
    end_date,
    status,
    location: text(formData, 'location'),
    country:  text(formData, 'country'),
    url:      text(formData, 'url'),
  }
}

// Registries, Events, Approvals (and its sidebar count), overviews, Gap Analysis, and the public calendar
function revalidateEventViews() {
  revalidatePath('/dashboard', 'layout')
  revalidatePath('/')
}

export async function createEventForOrg(formData: FormData): Promise<{ orgName: string; similar: SimilarEvent[] }> {
  const source = await assertEventAdmin()
  const orgId  = text(formData, 'ipo_id')
  if (!orgId) throw new Error('Pick the organisation this event belongs to')

  const result = await insertEventForOrg(createAdminClient(), orgId, parseCore(formData), source)
  revalidateEventViews()
  return { orgName: result.orgName, similar: result.similar }
}

export async function updateAnyEvent(formData: FormData): Promise<void> {
  await assertEventAdmin()
  const eventId = text(formData, 'event_id')
  if (!eventId) throw new Error('event_id is required')

  await updateEventCore(createAdminClient(), eventId, parseCore(formData))
  revalidateEventViews()
}

export async function deleteAnyEvent(eventId: string): Promise<void> {
  await assertEventAdmin()
  if (!eventId) throw new Error('event_id is required')

  await deleteEventById(createAdminClient(), eventId)
  revalidateEventViews()
}
