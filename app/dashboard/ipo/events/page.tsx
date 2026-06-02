import { createClient } from '@/lib/supabase/server'
import EventsTable from '@/components/events/EventsTable'
import PageInfo from '@/components/base/PageInfo'
import type { ActiveFilters } from '@/components/events/EventsTable/types'
import { PAGE_SIZE } from '@/components/events/EventsTable/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function EventsPage({ searchParams }: PageProps) {
  const sp     = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const orgId = user?.app_metadata?.org_id as string

  const status = typeof sp.status === 'string' ? sp.status : undefined
  const year   = typeof sp.year   === 'string' ? sp.year   : undefined
  const page   = Math.max(1, parseInt(typeof sp.page === 'string' ? sp.page : '1'))

  // Collect dynamic field filters: ?field_event_type=Workshop
  const dynamicFilters: Record<string, string> = {}
  for (const [k, v] of Object.entries(sp)) {
    if (k.startsWith('field_') && typeof v === 'string') {
      dynamicFilters[k.slice(6)] = v // strip 'field_' prefix
    }
  }

  // Build events query
  let query = supabase
    .from('events')
    .select('id,ipo_id,title,start_date,end_date,status,location,country,url,source,extra_fields', { count: 'exact' })
    .eq('ipo_id', orgId)
    .order('start_date', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (status) query = query.eq('status', status)
  if (year)   query = query.eq('year', parseInt(year))
  for (const [key, val] of Object.entries(dynamicFilters)) {
    query = query.eq(`extra_fields->>${key}`, val)
  }

  // Available years for filter dropdown
  const yearsQuery = supabase
    .from('events')
    .select('year')
    .eq('ipo_id', orgId)
    .order('year', { ascending: false })

  // Field registry for dynamic columns + filters
  const registryQuery = supabase
    .from('ipo_field_registry')
    .select('field_key,label,values')
    .eq('ipo_id', orgId)

  const [
    { data: events, count, error: eventsError },
    { data: yearsRaw },
    { data: registry },
  ] = await Promise.all([query, yearsQuery, registryQuery])

  if (eventsError) throw new Error(eventsError.message)

  const availableYears = [...new Set((yearsRaw ?? []).map(r => r.year).filter(Boolean))] as number[]

  const activeFilters: ActiveFilters = {
    ...(status ? { status } : {}),
    ...(year   ? { year }   : {}),
    ...Object.fromEntries(
      Object.entries(dynamicFilters).map(([k, v]) => [`field_${k}`, v])
    ),
  }

  return (
    <div className="p-8 space-y-2">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Events</h1>
          <PageInfo>The full list of events scraped from your IPO&apos;s website. Filter by status or date, search by title, and export your catalogue to a spreadsheet for offline use.</PageInfo>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {count ?? 0} total events in your catalogue
        </p>
      </div>

      <EventsTable
        events={events ?? []}
        totalCount={count ?? 0}
        page={page}
        registryFields={registry ?? []}
        availableYears={availableYears}
        activeFilters={activeFilters}
      />
    </div>
  )
}
