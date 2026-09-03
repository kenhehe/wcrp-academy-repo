import { Suspense } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import PageInfo from '@/components/base/PageInfo'
import EventRegistryFiltersBar from '@/components/events/EventRegistryFiltersBar'
import EventRegistryBrowser from '@/components/events/EventRegistryBrowser'
import EventRegistryBrowserSkeleton from '@/components/events/EventRegistryBrowserSkeleton'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function AcademyEventRegistryPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const queryText  = typeof sp.q      === 'string' ? sp.q      : undefined
  const ipoFilter  = typeof sp.ipo    === 'string' ? sp.ipo    : undefined
  const statusFilter = typeof sp.status === 'string' ? sp.status : undefined
  const yearFilter = typeof sp.year   === 'string' ? sp.year   : undefined
  const page       = Math.max(1, parseInt(typeof sp.page === 'string' ? sp.page : '1'))

  const db = createAdminClient()
  const [{ data: orgs }, { data: yearsRaw }] = await Promise.all([
    db.from('ipos').select('id,name,color_hex,type').order('name'),
    db.from('events').select('year'),
  ])

  const years = [...new Set((yearsRaw ?? []).map(r => r.year).filter(Boolean))].sort((a, b) => b - a) as number[]

  return (
    <div className="p-8 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Event Registry</h1>
          <PageInfo>
            Every event across every IPO and Lighthouse Activity in one place — search, filter, and
            browse regardless of approval status. Read-only: to edit an event, go to that org&rsquo;s
            own Events page.
          </PageInfo>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Browse every event across all orgs
        </p>
      </div>

      <EventRegistryFiltersBar
        orgs={orgs ?? []}
        activeQuery={queryText}
        activeIpo={ipoFilter}
        activeStatus={statusFilter}
        activeYear={yearFilter}
        years={years}
      >
        <Suspense key={`${queryText ?? ''}-${ipoFilter ?? ''}-${statusFilter ?? ''}-${yearFilter ?? ''}-${page}`} fallback={<EventRegistryBrowserSkeleton />}>
          <EventRegistryBrowser
            queryText={queryText}
            ipoFilter={ipoFilter}
            statusFilter={statusFilter}
            yearFilter={yearFilter}
            page={page}
            orgs={orgs ?? []}
            sp={sp}
          />
        </Suspense>
      </EventRegistryFiltersBar>
    </div>
  )
}
