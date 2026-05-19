import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseDate } from '../_shared/utils.ts'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const URL_RE  = /^https?:\/\/.+/

type WpRow = ReturnType<typeof mapPost>

function validateWpRow(row: WpRow): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!row.academy_id?.trim())
    errors.push('missing academy_id')

  if (!row.title?.trim())
    errors.push('missing title')
  else if (row.title.length > 500)
    errors.push(`title too long (${row.title.length} chars)`)

  if (row.start_date && !DATE_RE.test(row.start_date))
    errors.push(`invalid start_date "${row.start_date}"`)

  if (row.end_date && !DATE_RE.test(row.end_date))
    errors.push(`invalid end_date "${row.end_date}"`)

  if (
    row.start_date && row.end_date &&
    DATE_RE.test(row.start_date) && DATE_RE.test(row.end_date) &&
    row.end_date < row.start_date
  )
    errors.push(`end_date (${row.end_date}) before start_date (${row.start_date})`)

  if (row.official_link && !URL_RE.test(row.official_link))
    errors.push(`invalid official_link "${row.official_link}"`)

  if (row.permalink && !URL_RE.test(row.permalink))
    errors.push(`invalid permalink "${row.permalink}"`)

  return { valid: errors.length === 0, errors }
}

const WP_BASE = 'https://wcrp-academy.org/wp-json/wp/v2/catalogues'
const PER_PAGE = 100

// ACF slug → display label maps
const STATUS_MAP: Record<string, string> = {
  upcoming_training: 'Upcoming training',
  ongoing_training:  'Ongoing training',
  past_training:     'Past training',
  on_demand_training:'On Demand',
  on_demand:         'On Demand',
}

const TRAINING_TYPE_MAP: Record<string, string> = {
  conference:      'Conference',
  mooc:            'MOOC',
  science_meetings:'Science meetings',
  seasonal_school: 'Seasonal school',
  short_course:    'Short course',
  webinar:         'Webinar',
  workshop:        'Workshop',
}

const DELIVERY_MAP: Record<string, string> = {
  in_person: 'In person',
  online:    'Online',
  hybrid:    'Hybrid',
}

const BOOL_TRUE  = new Set(['yes', 'true', '1', 'y'])
const BOOL_FALSE = new Set(['no', 'none', 'false', '0', 'free', 'gratis'])

function toSlug(s: string) { return s.replace(/[_-]/g, ' ').toLowerCase().trim() }
function mapSlug(slug: string, map: Record<string, string>): string {
  return map[toSlug(slug).replace(/ /g, '_')] ?? map[slug.toLowerCase()] ?? slug
}
function parseBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v
  if (!v) return null
  const s = String(v).toLowerCase().trim()
  if (BOOL_TRUE.has(s))  return true
  if (BOOL_FALSE.has(s)) return false
  return null
}

interface WpPost {
  id:       number
  title:    { rendered: string }
  content:  { rendered: string }
  modified: string
  acf:      Record<string, unknown>
}

function mapPost(post: WpPost) {
  const acf = post.acf ?? {}

  // Target audience: pipe or comma separated slugs/labels
  const rawAudience = String(acf.event_target_audience ?? '')
  const audience = rawAudience
    .split(/[|,]/)
    .map(s => s.trim())
    .filter(Boolean)
    .join(', ')

  return {
    academy_id:        String(post.id),
    title:             post.title?.rendered?.replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim() ?? '',
    description:       post.content?.rendered ?? null,
    status:            mapSlug(String(acf.event_status ?? ''), STATUS_MAP) || null,
    start_date:        parseDate(String(acf.event_start_date ?? '')) ,
    end_date:          parseDate(String(acf.event_end_date   ?? '')),
    publish_date:      parseDate(String(acf.publication_date ?? '')),
    lead_organizer:    String(acf.corresponding_organizer ?? '') || null,
    partner_organizer: String(acf.partner_organizer       ?? '') || null,
    categories:        String(acf.event_categories        ?? '') || null,
    training_type:     mapSlug(String(acf.type_of_training ?? ''), TRAINING_TYPE_MAP) || null,
    delivery_mode:     mapSlug(String(acf.mode_of_delivery ?? ''), DELIVERY_MAP)      || null,
    location:          String(acf.event_location_platform  ?? '') || null,
    languages:         String(acf.event_language           ?? '') || null,
    target_audience:   audience || null,
    level:             String(acf.event_eligibility        ?? '') || null,
    cost:              parseBool(acf.cost__fee),
    funding_support:   parseBool(acf.funding_support),
    certificate:       parseBool(acf.certificate_of_completion),
    term_of_use:       parseBool(acf.event_term_of_use),
    official_link:     String(acf.envet_official_link          ?? '') || null,
    permalink:         String(acf.event_application_link       ?? '') || null,
    contact_person:    String(acf.official_contact_person      ?? '') || null,
    contact_email:     String(acf.event_official_contact_email ?? '') || null,
    extra_fields: {
      ...(acf.event_time_zone ? { timezone: String(acf.event_time_zone) } : {}),
    },
    updated_at: new Date().toISOString(),
  }
}

async function fetchAllPosts(): Promise<WpPost[]> {
  const all: WpPost[] = []
  let page = 1

  while (true) {
    const url = `${WP_BASE}?per_page=${PER_PAGE}&page=${page}&_fields=id,title,content,modified,acf&status=publish`
    const res = await fetch(url)

    if (res.status === 400) break // past last page
    if (!res.ok) throw new Error(`WP API error ${res.status}: ${await res.text()}`)

    const posts: WpPost[] = await res.json()
    if (!posts.length) break
    all.push(...posts)

    const totalPages = Number(res.headers.get('X-WP-TotalPages') ?? 1)
    if (page >= totalPages) break
    page++
  }

  return all
}

Deno.serve(async (req) => {
  // Allow manual POST trigger or scheduled GET
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const posts = await fetchAllPosts()
    if (!posts.length) {
      return Response.json({ message: 'No posts fetched', synced: 0 })
    }

    const mapped = posts.map(mapPost)

    const validRows:   WpRow[]  = []
    const invalidMsgs: string[] = []
    for (const row of mapped) {
      const { valid, errors } = validateWpRow(row)
      if (valid) {
        validRows.push(row)
      } else {
        const label = row.title ? `"${row.title.slice(0, 60)}"` : `academy_id=${row.academy_id}`
        const msg   = `INVALID ${label}: ${errors.join('; ')}`
        invalidMsgs.push(msg)
        console.warn(`[sync-academy-wp] ${msg}`)
      }
    }

    if (!validRows.length) {
      return Response.json({
        message: 'No valid rows after validation',
        invalid: invalidMsgs.length,
        errors:  invalidMsgs,
      })
    }

    const { error, count } = await supabase
      .from('academy_events')
      .upsert(validRows, { onConflict: 'academy_id', count: 'exact' })

    if (error) throw error

    return Response.json({
      message:        'Sync complete',
      fetched:        posts.length,
      valid:          validRows.length,
      invalid:        invalidMsgs.length,
      synced:         count ?? validRows.length,
      ...(invalidMsgs.length > 0 && { validationErrors: invalidMsgs }),
    })
  } catch (err) {
    console.error('sync-academy-wp error:', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
})
