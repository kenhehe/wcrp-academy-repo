import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { buttonVariants } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent, PopoverHeader, PopoverTitle, PopoverDescription } from '@/components/ui/popover'
import GapFiltersBar from '@/components/gaps/GapFiltersBar'
import { ChevronLeft, ChevronRight, CheckIcon, LinkIcon, InfoIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { markInAcademy, confirmMatch } from './actions'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  Upcoming:  'default',
  Ongoing:   'secondary',
  Past:      'outline',
  Cancelled: 'destructive',
  Postponed: 'outline',
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function GapAnalysisPage({ searchParams }: PageProps) {
  const sp        = await searchParams
  const supabase  = await createClient()

  const ipoFilter    = typeof sp.ipo    === 'string' ? sp.ipo    : undefined
  const statusFilter = typeof sp.status === 'string' ? sp.status : undefined
  const page         = Math.max(1, parseInt(typeof sp.page === 'string' ? sp.page : '1'))

  // Build missing events query
  let gapsQuery = supabase
    .from('events')
    .select('id,title,start_date,status,url,ipo_id,location,country', { count: 'exact' })
    .eq('in_academy', false)
    .order('start_date', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (ipoFilter)    gapsQuery = gapsQuery.eq('ipo_id', ipoFilter)
  if (statusFilter) gapsQuery = gapsQuery.eq('status', statusFilter)

  const [
    { data: ipos },
    { data: coverage },
    { data: gaps, count },
    { data: missingRaw },
  ] = await Promise.all([
    supabase.from('ipos').select('id,name').order('name'),
    supabase.from('ipo_coverage_stats').select('*').order('coverage_pct', { ascending: true }),
    gapsQuery,
    // Lightweight fetch — just ipo_id + status for all missing events for the breakdown
    supabase.from('events').select('ipo_id,status').eq('in_academy', false),
  ])

  // Build per-IPO status breakdown for the coverage cards
  type StatusBreakdown = { Upcoming: number; Ongoing: number; Past: number }
  const missingBreakdown = new Map<string, StatusBreakdown>()
  for (const e of missingRaw ?? []) {
    if (!missingBreakdown.has(e.ipo_id)) {
      missingBreakdown.set(e.ipo_id, { Upcoming: 0, Ongoing: 0, Past: 0 })
    }
    const b = missingBreakdown.get(e.ipo_id)!
    if (e.status === 'Upcoming')      b.Upcoming++
    else if (e.status === 'Ongoing')  b.Ongoing++
    else if (e.status === 'Past')     b.Past++
  }

  // Fuzzy match current page of gaps against academy_events
  const gapIds = (gaps ?? []).map(g => g.id)
  const { data: fuzzyRaw } = gapIds.length > 0
    ? await supabase.rpc('find_fuzzy_matches', { event_ids: gapIds, threshold: 0.15 })
    : { data: [] }

  type FuzzyMatch = { event_id: string; academy_event_id: string; academy_title: string; score: number; permalink: string | null }
  const matchMap = new Map<string, FuzzyMatch>(
    (fuzzyRaw ?? []).map((m: FuzzyMatch) => [m.event_id, m])
  )

  const ipoNameMap = new Map((ipos ?? []).map(i => [i.id, i.name]))
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Gap Analysis</h1>
        <p className="text-sm text-muted-foreground mt-1">
          IPO events not yet present in the Academy catalogue
        </p>
      </div>

      {/* Per-IPO coverage bars — sorted by coverage ascending so lowest is first */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {(coverage ?? []).map(row => {
          const b = missingBreakdown.get(row.ipo_id) ?? { Upcoming: 0, Ongoing: 0, Past: 0 }
          return (
            <Card key={row.ipo_id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{row.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {row.in_academy ?? 0} / {row.total_events ?? 0}
                  </span>
                </div>
                <Progress value={row.coverage_pct ?? 0} className="h-2" />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">
                    {row.coverage_pct ?? 0}% covered
                  </p>
                  {(row.missing_from_academy ?? 0) > 0 && (
                    <div className="flex items-center gap-2 text-xs tabular-nums">
                      <span className="text-muted-foreground">Missing:</span>
                      {b.Upcoming > 0 && (
                        <span className="text-primary font-medium">{b.Upcoming} upcoming</span>
                      )}
                      {b.Ongoing > 0 && (
                        <span className="text-foreground">{b.Ongoing} ongoing</span>
                      )}
                      {b.Past > 0 && (
                        <span className="text-muted-foreground">{b.Past} past</span>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Missing events table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">
              Missing events
              {count !== null && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({count} total)
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
                    These are IPO events that our system could not find in the WCRP Academy catalogue. Your job is to check each one and decide what to do.
                  </p>
                  <p>
                    Sometimes the system finds a possible match in the catalogue — it will show the suggested title below the event name with a colour-coded confidence score:
                  </p>
                  <ul className="space-y-1 pl-3">
                    <li><span className="font-medium text-green-600">Green (60%+)</span> — Very likely the same event</li>
                    <li><span className="font-medium text-amber-600">Amber (35–59%)</span> — Might be the same, worth a look</li>
                    <li><span className="font-medium">Gray (below 35%)</span> — Probably not the same event</li>
                  </ul>
                  <p>Click the suggested title to open the Academy catalogue page and check. Then choose:</p>
                  <ul className="space-y-1 pl-3">
                    <li><span className="font-medium text-amber-600">Yes, same event</span> — Use this when the suggestion is correct. It properly links the two records together.</li>
                    <li><span className="font-medium">Already in Academy</span> — Use this when you know the event is in the catalogue but the suggestion is wrong or missing. It marks it as covered without creating a link.</li>
                  </ul>
                </PopoverDescription>
              </PopoverContent>
            </Popover>
          </div>
          <GapFiltersBar
            ipos={ipos ?? []}
            activeIpo={ipoFilter}
            activeStatus={statusFilter}
          />
        </div>

        <div className="rounded-md border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Event</th>
                <th className="px-4 py-3 text-left font-medium">IPO</th>
                <th className="px-4 py-3 text-left font-medium">Start</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {(gaps ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No gaps found
                    {(ipoFilter || statusFilter) && ' for the selected filters'}
                  </td>
                </tr>
              ) : (
                (gaps ?? []).map(row => {
                  const match = matchMap.get(row.id)
                  return (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 max-w-sm">
                      {row.url ? (
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate font-medium hover:underline hover:text-primary transition-colors block"
                        >
                          {row.title}
                        </a>
                      ) : (
                        <p className="truncate font-medium">{row.title}</p>
                      )}
                      {(row.location || row.country) && (
                        <p className="truncate text-xs text-muted-foreground mt-0.5">
                          {[row.location, row.country].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {match && (
                        <p className="truncate text-xs text-amber-600 mt-0.5">
                          ≈{' '}
                          {match.permalink ? (
                            <a
                              href={match.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              {match.academy_title}
                            </a>
                          ) : (
                            match.academy_title
                          )}
                          <span className={`ml-1 font-medium ${match.score >= 0.6 ? 'text-green-600' : match.score >= 0.35 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                            ({Math.round(match.score * 100)}%)
                          </span>
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {ipoNameMap.get(row.ipo_id) ?? row.ipo_id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums text-xs text-muted-foreground">
                      {row.start_date}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[row.status] ?? 'outline'} className="text-xs">
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive" className="text-xs font-normal">
                            Not in Academy
                          </Badge>
                          <form action={markInAcademy}>
                            <input type="hidden" name="id" value={row.id} />
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                            >
                              <CheckIcon className="h-3 w-3" />
                              Already in Academy
                            </button>
                          </form>
                        </div>
                        {match && (
                          <form action={confirmMatch}>
                            <input type="hidden" name="event_id"        value={row.id} />
                            <input type="hidden" name="academy_event_id" value={match.academy_event_id} />
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1 rounded-md border border-amber-300 px-2 py-0.5 text-xs text-amber-600 transition-colors hover:border-amber-500 hover:bg-amber-50"
                            >
                              <LinkIcon className="h-3 w-3" />
                              Yes, same event
                            </button>
                          </form>
                        )}
                      </div>
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
