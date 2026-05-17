const WP_BASE    = 'https://wcrp-academy.org/wp-json/wp/v2'
const PER_PAGE   = 100

function getAuthHeader(): HeadersInit {
  const user = process.env.WP_API_USER
  const pass = process.env.WP_API_PASSWORD
  if (!user || !pass) throw new Error('WP_API_USER / WP_API_PASSWORD env vars not set')
  const credentials = Buffer.from(`${user}:${pass}`).toString('base64')
  return { Authorization: `Basic ${credentials}` }
}

export interface WpCatalogueItem {
  id:       number
  title:    { rendered: string }
  content:  { rendered: string }
  modified: string
  acf: {
    corresponding_organizer?:    string
    partner_organizer?:          string
    event_status?:               string
    event_start_date?:           string
    event_end_date?:             string
    publication_date?:           string
    event_time_zone?:            string
    event_categories?:           string
    type_of_training?:           string
    mode_of_delivery?:           string
    event_location_platform?:    string
    event_language?:             string
    event_target_audience?:      string
    event_eligibility?:          string
    cost__fee?:                  string | boolean
    funding_support?:            string | boolean
    certificate_of_completion?:  string | boolean
    event_term_of_use?:          string | boolean
    envet_official_link?:        string
    event_application_link?:     string
    official_contact_person?:    string
    event_official_contact_email?: string
  }
}

export interface WpFetchResult {
  items: WpCatalogueItem[]
  total: number
  totalPages: number
}

export async function fetchWpCatalogues(page = 1, perPage = PER_PAGE): Promise<WpFetchResult> {
  const url = `${WP_BASE}/catalogues?per_page=${perPage}&page=${page}&_fields=id,title,content,modified,acf&status=publish`

  const res = await fetch(url, {
    headers: getAuthHeader(),
    next: { revalidate: 300 }, // cache 5 min
  })

  if (!res.ok) {
    throw new Error(`WordPress API error ${res.status}: ${await res.text()}`)
  }

  const items: WpCatalogueItem[] = await res.json()
  const total      = Number(res.headers.get('X-WP-Total')      ?? 0)
  const totalPages = Number(res.headers.get('X-WP-TotalPages') ?? 1)

  return { items, total, totalPages }
}

export async function fetchAllWpCatalogues(): Promise<WpCatalogueItem[]> {
  const first = await fetchWpCatalogues(1)
  if (first.totalPages <= 1) return first.items

  const rest = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, i) => fetchWpCatalogues(i + 2))
  )

  return [first.items, ...rest.map(r => r.items)].flat()
}
