export interface ScrapedEvent {
  ipo_id: string
  title: string
  start_date: string        // YYYY-MM-DD
  end_date?: string | null
  location?: string | null
  country?: string | null
  url?: string | null
  status: 'Upcoming' | 'Ongoing' | 'Past'
  source?: string
  source_url?: string | null
  // CMIP-specific
  speaker?: string | null
  institution?: string | null
  cmip_phase?: string | null
}

export interface ScrapeResult {
  runId: string
  ipoId: string
  eventsFound: number
  eventsNew: number
  eventsUpdated: number
  errors: string[]
}
