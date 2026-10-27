import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveAcademyDates, utcToday } from '../_shared/academy-dates.ts'
import { wpTitleText } from '../_shared/wp-text.ts'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const URL_RE  = /^https?:\/\/.+/

type WpRow = ReturnType<typeof mapPost>

// Problems that keep a record out of the sync, in words the sync button's message can show
function validateWpRow(row: WpRow): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!row.academy_id?.trim())
    errors.push('no WordPress id')

  if (!row.title?.trim())
    errors.push('no title')
  else if (row.title.length > 500)
    errors.push(`title is ${row.title.length} characters, over 500`)

  if (row.start_date && !DATE_RE.test(row.start_date))
    errors.push(`start date "${row.start_date}" isn't a date`)

  if (row.end_date && !DATE_RE.test(row.end_date))
    errors.push(`end date "${row.end_date}" isn't a date`)

  if (
    row.start_date && row.end_date &&
    DATE_RE.test(row.start_date) && DATE_RE.test(row.end_date) &&
    row.end_date < row.start_date
  )
    errors.push(`end date ${row.end_date} is before start date ${row.start_date}`)

  if (row.official_link && !URL_RE.test(row.official_link))
    errors.push(`official link "${row.official_link}" isn't a web address`)

  if (row.permalink && !URL_RE.test(row.permalink))
    errors.push(`application link "${row.permalink}" isn't a web address`)

  return { valid: errors.length === 0, errors }
}

const WP_BASE = 'https://wcrp-academy.org/wp-json/wp/v2/catalogues'
const PER_PAGE = 100

// ACF slug → display label maps (event_status is handled by _shared/academy-dates.ts)
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

// `today` (UTC) decides Past / Ongoing / Upcoming from the dates; see _shared/academy-dates.ts
function mapPost(post: WpPost, today: string) {
  const acf = post.acf ?? {}
  const dates = resolveAcademyDates({
    tag:     acf.event_status,
    start:   acf.event_start_date,
    end:     acf.event_end_date,
    publish: acf.publication_date,
  }, today)

  // Target audience: pipe or comma separated slugs/labels
  const rawAudience = String(acf.event_target_audience ?? '')
  const audience = rawAudience
    .split(/[|,]/)
    .map(s => s.trim())
    .filter(Boolean)
    .join(', ')

  return {
    academy_id:        String(post.id),
    title:             wpTitleText(post.title?.rendered),
    description:       post.content?.rendered ?? null,
    // An unknown tag with no dates is kept as WordPress sent it, so it shows up instead of vanishing
    status:            dates.status ?? (String(acf.event_status ?? '').trim() || null),
    start_date:        dates.start_date,
    end_date:          dates.end_date,
    publish_date:      dates.publish_date,
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

    const today  = utcToday()
    const mapped = posts.map(post => mapPost(post, today))

    // Records with a problem are left out (the copy from an earlier sync, if any, stays) and
    // listed in the reply, so the sync button can say which ones to fix on WordPress
    const validRows: WpRow[] = []
    const skipped: { wp_id: string; title: string; problems: string[] }[] = []
    for (const row of mapped) {
      const { valid, errors } = validateWpRow(row)
      if (valid) {
        validRows.push(row)
      } else {
        skipped.push({ wp_id: row.academy_id, title: row.title || `WordPress post ${row.academy_id}`, problems: errors })
        console.warn(`[sync-academy-wp] skipped ${row.academy_id} "${row.title.slice(0, 60)}": ${errors.join('; ')}`)
      }
    }

    if (!validRows.length) {
      return Response.json({ message: 'No valid rows after validation', fetched: posts.length, synced: 0, skipped })
    }

    const { error, count } = await supabase
      .from('academy_events')
      .upsert(validRows, { onConflict: 'academy_id', count: 'exact' })

    if (error) throw error

    return Response.json({
      message: 'Sync complete',
      fetched: posts.length,
      synced:  count ?? validRows.length,
      skipped,
    })
  } catch (err) {
    console.error('sync-academy-wp error:', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
})
