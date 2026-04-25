'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const REVALIDATE = '/dashboard/ipo/events'

// Collect extra_fields from FormData — keys prefixed with ef__
function extractExtraFields(fd: FormData): Record<string, string> {
  const extra: Record<string, string> = {}
  for (const [key, value] of fd.entries()) {
    if (key.startsWith('ef__') && typeof value === 'string' && value.trim()) {
      extra[key.slice(4)] = value.trim()
    }
  }
  return extra
}

export async function createEvent(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const orgId = user.app_metadata?.org_id as string
  if (!orgId) throw new Error('No org_id on user')

  const extra_fields = extractExtraFields(formData)

  const payload = {
    ipo_id:       orgId,
    title:        (formData.get('title') as string).trim(),
    start_date:   formData.get('start_date') as string,
    end_date:     (formData.get('end_date') as string) || null,
    status:       formData.get('status') as string,
    location:     (formData.get('location') as string) || null,
    country:      (formData.get('country') as string) || null,
    url:          (formData.get('url') as string) || null,
    source:       'manual',
    extra_fields: Object.keys(extra_fields).length ? extra_fields : {},
  }

  const { error } = await supabase
    .from('events')
    .insert(payload)

  if (error) throw new Error(error.message)
  revalidatePath(REVALIDATE)
}

export async function updateEvent(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const orgId  = user.app_metadata?.org_id as string
  const eventId = formData.get('event_id') as string
  if (!eventId) throw new Error('event_id is required')

  const extra_fields = extractExtraFields(formData)

  const payload = {
    title:        (formData.get('title') as string).trim(),
    start_date:   formData.get('start_date') as string,
    end_date:     (formData.get('end_date') as string) || null,
    status:       formData.get('status') as string,
    location:     (formData.get('location') as string) || null,
    country:      (formData.get('country') as string) || null,
    url:          (formData.get('url') as string) || null,
    extra_fields: Object.keys(extra_fields).length ? extra_fields : {},
    last_seen_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('events')
    .update(payload)
    .eq('id', eventId)
    .eq('ipo_id', orgId) // scoped — can only edit own events

  if (error) throw new Error(error.message)
  revalidatePath(REVALIDATE)
}

export async function deleteEvent(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const orgId = user.app_metadata?.org_id as string

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId)
    .eq('ipo_id', orgId) // scoped — can only delete own events

  if (error) throw new Error(error.message)
  revalidatePath(REVALIDATE)
}
