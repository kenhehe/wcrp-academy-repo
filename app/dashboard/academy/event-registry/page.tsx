import { Suspense } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import PageHeader from '@/components/base/PageHeader'
import EventRegistryFiltersBar from '@/components/events/EventRegistryFiltersBar'
import EventRegistryBrowser from '@/components/events/EventRegistryBrowser'
import EventRegistryBrowserSkeleton from '@/components/events/EventRegistryBrowserSkeleton'
import { AddEventButton } from '@/components/events/AdminEventDialogs'

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
  const [{ data: orgs }, yearsRaw] = await Promise.all([
    db.from('ipos').select('id,name,color_hex,type').order('name'),
    // Every event, so page past the 1000-row cap or the newest years go missing
    fetchAllRows<{ year: number | null }>('event years query', (from, to) => db.from('events').select('year').order('id').range(from, to)),
  ])

  const years = [...new Set(yearsRaw.map(r => r.year).filter((y): y is number => y != null))].sort((a, b) => b - a)

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Event Registry"
        info={
          <>
            Every event across every IPO and Lighthouse Activity in one place — search, filter, and
            browse regardless of approval status. Add an event for any org, or edit and delete any
            event from the row buttons. New events wait in Approvals before they reach the public calendar.
          </>
        }
        description="Browse, add and edit events across all orgs"
        actions={<AddEventButton orgs={(orgs ?? []).filter(o => o.type === 'ipo' || o.type === 'lighthouse')} />}
      />

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
