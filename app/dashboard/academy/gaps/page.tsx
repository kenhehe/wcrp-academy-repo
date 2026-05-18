import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Popover, PopoverTrigger, PopoverContent, PopoverHeader, PopoverTitle, PopoverDescription } from '@/components/ui/popover'
import GapFiltersBar from '@/components/gaps/GapFiltersBar'
import { InfoIcon } from 'lucide-react'
import GapsTable from './_components/GapsTable'
import GapsTableSkeleton from './_components/GapsTableSkeleton'
import IPOCoverageChart from './_components/IPOCoverageChart'
import type { IPOChartRow } from './_components/IPOCoverageChart'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function GapAnalysisPage({ searchParams }: PageProps) {
  const sp       = await searchParams
  const supabase = await createClient()

  const ipoFilter    = typeof sp.ipo    === 'string' ? sp.ipo    : undefined
  const statusFilter = typeof sp.status === 'string' ? sp.status : undefined
  const page         = Math.max(1, parseInt(typeof sp.page === 'string' ? sp.page : '1'))

  const [
    { data: ipos },
    { data: coverage },
    { data: missingRaw },
  ] = await Promise.all([
    supabase.from('ipos').select('id,name').order('name'),
    supabase.from('ipo_coverage_stats').select('*').order('coverage_pct', { ascending: true }),
    supabase.from('events').select('ipo_id,status').eq('in_academy', false),
  ])

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

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Gap Analysis</h1>
        <p className="text-sm text-muted-foreground mt-1">
          IPO events not yet present in the Academy catalogue
        </p>
      </div>

      {/* Per-IPO coverage chart */}
      {(() => {
        const chartData: IPOChartRow[] = (coverage ?? [])
          .sort((a, b) => (b.missing_from_academy ?? 0) - (a.missing_from_academy ?? 0))
          .map(row => {
            const bd = missingBreakdown.get(row.ipo_id) ?? { Upcoming: 0, Ongoing: 0, Past: 0 }
            return {
              name:            row.name,
              inAcademy:       row.in_academy       ?? 0,
              missingUpcoming: bd.Upcoming,
              missingOngoing:  bd.Ongoing,
              missingPast:     bd.Past,
            }
          })
        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Academy coverage by IPO</CardTitle>
              <p className="text-xs text-muted-foreground">
                Sorted by most events still missing · amber = upcoming (primary focus)
              </p>
            </CardHeader>
            <CardContent>
              <IPOCoverageChart data={chartData} />
            </CardContent>
          </Card>
        )
      })()}

      {/* Missing events table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Missing events</h2>
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

        <Suspense key={`${ipoFilter ?? ''}-${statusFilter ?? ''}-${page}`} fallback={<GapsTableSkeleton />}>
          <GapsTable
            ipoFilter={ipoFilter}
            statusFilter={statusFilter}
            page={page}
            ipos={ipos ?? []}
            sp={sp}
          />
        </Suspense>
      </div>
    </div>
  )
}
