import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { buttonVariants } from '@/components/ui/button'
import GapFiltersBar from '@/components/gaps/GapFiltersBar'
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

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
    .select('id,title,start_date,status,url,ipo_id', { count: 'exact' })
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
          <h2 className="text-base font-semibold">
            Missing events
            {count !== null && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({count} total)
              </span>
            )}
          </h2>
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
                <th className="px-4 py-3 text-left font-medium w-10" />
              </tr>
            </thead>
            <tbody>
              {(gaps ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No gaps found
                    {(ipoFilter || statusFilter) && ' for the selected filters'}
                  </td>
                </tr>
              ) : (
                (gaps ?? []).map(row => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 max-w-sm">
                      <p className="truncate font-medium">{row.title}</p>
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
                      <Badge variant="destructive" className="text-xs font-normal">
                        Not in Academy
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {row.url && (
                        <Link
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
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
