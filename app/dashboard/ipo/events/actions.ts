'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  const title     = (formData.get('title') as string).trim()
  const startDate = formData.get('start_date') as string

  // Must use admin client — RLS on events table blocks ipo_user role from inserting
  const db = createAdminClient()

  // Exact-match check, scoped to this org only — cross-IPO duplicates are
  // expected and handled separately by the Duplicates feature.
  const { data: existing } = await db
    .from('events')
    .select('id,title')
    .eq('ipo_id', orgId)
    .eq('start_date', startDate)
    .ilike('title', title) // no wildcards -> case-insensitive equality
    .limit(1)

  if (existing && existing.length > 0) {
    throw new Error(`An event with this title and date already exists: "${existing[0].title}". Edit the existing event instead, or use a different title/date.`)
  }

  const extra_fields = extractExtraFields(formData)

  const payload = {
    ipo_id:          orgId,
    title,
    start_date:      startDate,
    end_date:        (formData.get('end_date') as string) || null,
    status:          formData.get('status') as string,
    location:        (formData.get('location') as string) || null,
    country:         (formData.get('country') as string) || null,
    url:             (formData.get('url') as string) || null,
    source:          'manual',
    extra_fields:    Object.keys(extra_fields).length ? extra_fields : {},
    // All manually added events require approval before appearing on the public calendar
    approval_status: 'pending',
    // Checkboxes are absent from FormData entirely when unchecked (never "false")
    wants_social_media:    formData.get('wants_social_media') === 'on',
    wants_website_article: formData.get('wants_website_article') === 'on',
    wants_newsletter:      formData.get('wants_newsletter') === 'on',
  }

  const { error } = await db.from('events').insert(payload)
  if (error) {
    // Safety net for the rare race the pre-check above can't catch
    if (error.code === '23505') {
      throw new Error('An event with this title and date already exists for your organization.')
    }
    throw new Error(error.message)
  }
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
    wants_social_media:    formData.get('wants_social_media') === 'on',
    wants_website_article: formData.get('wants_website_article') === 'on',
    wants_newsletter:      formData.get('wants_newsletter') === 'on',
  }

  // Must use admin client — RLS blocks ipo_user from updating
  const db = createAdminClient()
  const { error } = await db
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

  // Must use admin client — RLS blocks ipo_user from deleting
  const db = createAdminClient()
  const { error } = await db
    .from('events')
    .delete()
    .eq('id', eventId)
    .eq('ipo_id', orgId) // scoped — can only delete own events

  if (error) throw new Error(error.message)
  revalidatePath(REVALIDATE)
}
