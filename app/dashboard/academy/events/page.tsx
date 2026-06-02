import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PageInfo from '@/components/base/PageInfo'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent, PopoverHeader, PopoverTitle, PopoverDescription } from '@/components/ui/popover'
import AcademyEventsFilters from '@/components/academy/AcademyEventsFilters'
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, MinusCircle, InfoIcon } from 'lucide-react'
import { resolveStatus } from '@/lib/data/academy-events.types'
import { cn } from '@/lib/utils'
import { markAsExternal } from './actions'
import MarkExternalButton from './_components/MarkExternalButton'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function AcademyCoveragePage({ searchParams }: PageProps) {
  const sp       = await searchParams
  const supabase = await createClient()

  const matchFilter = typeof sp.match === 'string' ? sp.match : undefined
  const yearFilter  = typeof sp.year  === 'string' ? sp.year  : undefined
  const page        = Math.max(1, parseInt(typeof sp.page === 'string' ? sp.page : '1'))

  // Fetch stats data and matched links in parallel
  const [{ data: allMeta }, { data: matchedLinks }] = await Promise.all([
    supabase.from('academy_events').select('id,is_external,start_date'),
    supabase.from('events').select('academy_event_id').not('academy_event_id', 'is', null),
  ])

  const matchedIds = [...new Set(
    (matchedLinks ?? []).map(l => l.academy_event_id).filter((id): id is string => !!id)
  )]
  const matchedSet = new Set(matchedIds)

  const total          = allMeta?.length ?? 0
  const externalCount  = (allMeta ?? []).filter(e => e.is_external).length
  const matchedCount   = matchedIds.length
  const needsReview    = total - matchedCount - externalCount
  const ipoRelevant    = total - externalCount
  const coveragePct    = ipoRelevant > 0 ? Math.round(matchedCount / ipoRelevant * 100) : 0

  const yearOptions = [...new Set(
    (allMeta ?? [])
      .map(e => e.start_date ? new Date(e.start_date + 'T00:00:00').getFullYear().toString() : null)
      .filter((y): y is string => !!y)
  )].sort().reverse()

  // Build main paginated query
  let mainQuery = supabase
    .from('academy_events')
    .select('id,academy_id,title,start_date,end_date,publish_date,status,official_link,is_external', { count: 'exact' })
    .order('start_date', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (matchFilter === 'matched') {
    mainQuery = matchedIds.length > 0
      ? mainQuery.in('id', matchedIds)
      : mainQuery.eq('id', 'no-results')
  } else if (matchFilter === 'needs_review') {
    mainQuery = mainQuery.eq('is_external', false)
    if (matchedIds.length > 0) mainQuery = mainQuery.not('id', 'in', `(${matchedIds.join(',')})`)
  } else if (matchFilter === 'external') {
    mainQuery = mainQuery.eq('is_external', true)
  }

  if (yearFilter) {
    const y = parseInt(yearFilter)
    mainQuery = mainQuery
      .gte('start_date', `${y}-01-01`)
      .lte('start_date', `${y}-12-31`)
  }

  const { data: events, count } = await mainQuery
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  const stats = [
    { label: 'Total in Catalogue', value: total,         sub: undefined },
    { label: 'Matched to IPO',     value: matchedCount,  sub: 'Linked to an IPO source' },
    { label: 'Needs Review',       value: needsReview,   sub: 'No IPO match found yet' },
    { label: 'Not IPO Events',     value: externalCount, sub: 'Sourced outside the 7 IPOs' },
  ]

  return (
    <div className="p-8 space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Academy Coverage</h1>
          <PageInfo>Cross-references Academy events with IPO-scraped events to show which Academy listings are backed by an IPO source. Use this to identify events that are standalone or missing a source link.</PageInfo>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Which events in the Academy catalogue are linked to an IPO source
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

      {/* Coverage progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>IPO coverage ({matchedCount} of {ipoRelevant} IPO-relevant events matched)</span>
          <span className="font-medium">{coveragePct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${coveragePct}%` }} />
        </div>
      </div>

      {/* Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">
              Catalogue
              {count !== null && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({count} events)
                </span>
              )}
            </h2>
            <Popover>
              <PopoverTrigger className="text-muted-foreground hover:text-foreground transition-colors">
                <InfoIcon className="h-4 w-4" />
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" className="w-80">
                <PopoverHeader>
                  <PopoverTitle>How this works</PopoverTitle>
                </PopoverHeader>
                <PopoverDescription className="space-y-2 text-xs leading-relaxed">
                  <p>
                    This page shows every event in the WCRP Academy catalogue and whether it has been
                    linked to one of the 7 IPO sources. Not all Academy events come from IPOs —
                    some are sourced from partner organisations or external bodies.
                  </p>
                  <ul className="space-y-1.5 pl-3">
                    <li>
                      <span className="font-medium text-emerald-600">Matched</span> — This event
                      has been linked to a record from one of the 7 IPOs.
                    </li>
                    <li>
                      <span className="font-medium text-amber-600">Needs review</span> — No IPO
                      match has been found yet. It may exist in an IPO catalogue — check the
                      Gap Analysis page to resolve it.
                    </li>
                    <li>
                      <span className="font-medium text-muted-foreground">Not an IPO event</span> — This
                      event was confirmed as coming from outside the 7 IPOs. It is excluded from
                      coverage calculations.
                    </li>
                  </ul>
                  <p>
                    Use <span className="font-medium">&ldquo;Not an IPO event&rdquo;</span> on any
                    row you are certain was not sourced from an IPO. This keeps the coverage % honest.
                  </p>
                </PopoverDescription>
              </PopoverContent>
            </Popover>
          </div>
          <AcademyEventsFilters
            yearOptions={yearOptions}
            activeMatch={matchFilter}
            activeYear={yearFilter}
          />
        </div>

        <div className="rounded-md border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">Dates</th>
                <th className="px-4 py-3 text-left font-medium">IPO Match</th>
                <th className="px-4 py-3 text-left font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {(events ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No events found
                    {(matchFilter || yearFilter) && ' for the selected filters'}
                  </td>
                </tr>
              ) : (
                (events ?? []).map(row => {
                  const isMatched  = matchedSet.has(row.id)
                  const isExternal = row.is_external

                  return (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 max-w-xs">
                        {row.official_link ? (
                          <a
                            href={row.official_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate font-medium hover:underline hover:text-primary transition-colors block"
                          >
                            {row.title}
                          </a>
                        ) : (
                          <p className="truncate font-medium">{row.title}</p>
                        )}
                        {row.academy_id && (
                          <p className="text-xs text-muted-foreground">{row.academy_id}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums text-xs text-muted-foreground">
                        {row.start_date ? (
                          <>
                            {row.start_date}
                            {row.end_date && row.end_date !== row.start_date && (
                              <span> → {row.end_date}</span>
                            )}
                          </>
                        ) : (
                          <span className="italic">{resolveStatus(row)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isExternal ? (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MinusCircle className="h-3.5 w-3.5 flex-shrink-0" />
                            <span>Not an IPO event</span>
                          </div>
                        ) : isMatched ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                            <span>Matched</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-amber-600">
                            <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                            <span>Needs review</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!isMatched && !isExternal && (
                          <MarkExternalButton action={markAsExternal} eventId={row.id} />
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link href={`?${buildPageParams(sp, page - 1)}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              ) : (
                <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'opacity-50 pointer-events-none')}>
                  <ChevronLeft className="h-4 w-4" />
                </span>
              )}
              {page < totalPages ? (
                <Link href={`?${buildPageParams(sp, page + 1)}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
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
