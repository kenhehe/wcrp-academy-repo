import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import AcademyEventsFilters from '@/components/academy/AcademyEventsFilters'
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  Upcoming: 'default',
  Ongoing:  'secondary',
  Past:     'outline',
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function AcademyEventsPage({ searchParams }: PageProps) {
  const sp       = await searchParams
  const supabase = await createClient()

  const statusFilter = typeof sp.status === 'string' ? sp.status : undefined
  const typeFilter   = typeof sp.type   === 'string' ? sp.type   : undefined
  const yearFilter   = typeof sp.year   === 'string' ? sp.year   : undefined
  const page         = Math.max(1, parseInt(typeof sp.page === 'string' ? sp.page : '1'))

  let mainQuery = supabase
    .from('academy_events')
    .select(
      'id,academy_id,title,start_date,end_date,status,training_type,lead_organizer,official_link',
      { count: 'exact' }
    )
    .order('start_date', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (statusFilter) mainQuery = mainQuery.eq('status', statusFilter)
  if (typeFilter)   mainQuery = mainQuery.eq('training_type', typeFilter)
  if (yearFilter) {
    const y = parseInt(yearFilter)
    mainQuery = mainQuery
      .gte('start_date', `${y}-01-01`)
      .lte('start_date', `${y}-12-31`)
  }

  const [
    { data: events, count },
    { data: allMeta },
    { data: matchedLinks },
  ] = await Promise.all([
    mainQuery,
    supabase.from('academy_events').select('id,status,training_type,start_date'),
    supabase.from('events').select('academy_event_id').not('academy_event_id', 'is', null),
  ])

  // Build match count map: academy_event_id -> number of linked IPO events
  const matchCountMap = new Map<string, number>()
  for (const link of matchedLinks ?? []) {
    if (!link.academy_event_id) continue
    matchCountMap.set(link.academy_event_id, (matchCountMap.get(link.academy_event_id) ?? 0) + 1)
  }

  const total         = allMeta?.length ?? 0
  const matchedCount  = matchCountMap.size
  const unmatchedCount = total - matchedCount
  const coveragePct   = total > 0 ? Math.round((matchedCount / total) * 100) : 0

  // Filter options derived from all records
  const statusOptions = [...new Set(
    (allMeta ?? []).map(e => e.status).filter((s): s is string => !!s)
  )].sort()

  const typeOptions = [...new Set(
    (allMeta ?? []).map(e => e.training_type).filter((t): t is string => !!t)
  )].sort()

  const yearOptions = [...new Set(
    (allMeta ?? [])
      .map(e => e.start_date ? new Date(e.start_date + 'T00:00:00').getFullYear().toString() : null)
      .filter((y): y is string => !!y)
  )].sort().reverse()

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  const stats = [
    { label: 'Total Events',  value: total },
    { label: 'Matched',       value: matchedCount,   sub: 'Linked to IPO event' },
    { label: 'Unmatched',     value: unmatchedCount, sub: 'No IPO link found' },
    { label: 'Coverage',      value: `${coveragePct}%`, sub: 'Of catalogue matched' },
  ]

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Academy Events</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Catalogue stocktake — Academy events and their IPO coverage
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, sub }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{value}</p>
              {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            Catalogue
            {count !== null && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({count} events)
              </span>
            )}
          </h2>
          <AcademyEventsFilters
            statusOptions={statusOptions}
            typeOptions={typeOptions}
            yearOptions={yearOptions}
            activeStatus={statusFilter}
            activeType={typeFilter}
            activeYear={yearFilter}
          />
        </div>

        {/* IPO Match explanation */}
        <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <p>
            <span className="font-medium text-foreground">IPO Match</span> shows whether this
            academy event has been recognised in any IPO&apos;s event catalogue. A green checkmark
            means one or more IPOs are already tracking the same event — helping you see what&apos;s
            covered. Matches refresh after each sync. If you&apos;ve just imported new events and
            matches look outdated, go to{' '}
            <Link href="/dashboard/academy/health" className="underline underline-offset-2 hover:text-foreground transition-colors">
              System Health
            </Link>
            {' '}and trigger a sync for the relevant IPO.
          </p>
        </div>

        <div className="rounded-md border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">Dates</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Lead Organizer</th>
                <th className="px-4 py-3 text-left font-medium">IPO Match</th>
              </tr>
            </thead>
            <tbody>
              {(events ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No events found
                    {(statusFilter || typeFilter || yearFilter) && ' for the selected filters'}
                  </td>
                </tr>
              ) : (
                (events ?? []).map(row => {
                  const matchCount = matchCountMap.get(row.id) ?? 0
                  const isMatched  = matchCount > 0
                  return (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 max-w-xs">
                        {row.official_link ? (
                          <Link
                            href={row.official_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate font-medium hover:underline hover:text-primary transition-colors block"
                          >
                            {row.title}
                          </Link>
                        ) : (
                          <p className="truncate font-medium">{row.title}</p>
                        )}
                        {row.academy_id && (
                          <p className="text-xs text-muted-foreground truncate">{row.academy_id}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums text-xs text-muted-foreground">
                        {row.start_date}
                        {row.end_date && row.end_date !== row.start_date && (
                          <span> → {row.end_date}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.status ? (
                          <Badge variant={STATUS_VARIANT[row.status] ?? 'outline'} className="text-xs">
                            {row.status}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {row.training_type ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px]">
                        <p className="truncate">{row.lead_organizer ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        {isMatched ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="tabular-nums">{matchCount} linked</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                            <span>Unmatched</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={`?${buildPageParams(sp, page - 1)}`}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              ) : (
                <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'opacity-50 pointer-events-none')}>
                  <ChevronLeft className="h-4 w-4" />
                </span>
              )}
              {page < totalPages ? (
                <Link
                  href={`?${buildPageParams(sp, page + 1)}`}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'opacity-50 pointer-events-none')}>
                  <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function buildPageParams(
  sp: Record<string, string | string[] | undefined>,
  newPage: number
): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'page') continue
    if (typeof v === 'string') params.set(k, v)
  }
  params.set('page', String(newPage))
  return params.toString()
}
