import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { must } from '@/lib/supabase/must'
import PageHeader from '@/components/base/PageHeader'
import StatTile from '@/components/base/StatTile'
import { Popover, PopoverTrigger, PopoverContent, PopoverHeader, PopoverTitle, PopoverDescription } from '@/components/ui/popover'
import GapFiltersBar from '@/components/gaps/GapFiltersBar'
import { InfoIcon } from 'lucide-react'
import { getCoverageRows } from '@/lib/data/coverage'
import { coveragePct, formatPct, sumCoverage } from '@/lib/data/coverage.types'
import GapsTable from './_components/GapsTable'
import GapsTableSkeleton from './_components/GapsTableSkeleton'
import CoverageTable from './_components/CoverageTable'

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

  const [iposRes, coverage] = await Promise.all([
    supabase.from('ipos').select('id,name').eq('type', 'ipo').order('name'),
    getCoverageRows(),
  ])
  const ipos = must('ipos query', iposRes)

  const totals        = sumCoverage(coverage)
  const upToDate      = coverage.filter(r => r.upcoming === 0)
  const withUpcoming  = coverage.length - upToDate.length

  return (
    <div className="p-8 space-y-8">
      <PageHeader
        title="Gap Analysis"
        info="Shows IPO-scraped events that have not yet been added to the WCRP Academy catalogue. Use this to identify upcoming events that need manual review before publishing to the Academy website."
        description="IPO events not yet present in the Academy catalogue"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile
          label="Upcoming events missing"
          value={totals.upcoming}
          sub={withUpcoming === 0
            ? 'Every upcoming IPO event is in the Academy'
            : `across ${withUpcoming} IPO${withUpcoming === 1 ? '' : 's'}, the ones to add first`}
        />
        <StatTile
          label="Academy coverage"
          value={formatPct(coveragePct(totals))}
          sub={`${totals.inAcademy} of ${totals.total} IPO events are in the Academy`}
        />
        <StatTile
          label="IPOs with nothing upcoming missing"
          value={`${upToDate.length} of ${coverage.length}`}
          sub={upToDate.length > 0 ? upToDate.map(r => r.name).join(', ') : 'None yet'}
        />
      </div>

      <CoverageTable rows={coverage} />

      {/* Missing events table */}
      <div id="missing" className="space-y-4 scroll-mt-4">
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
                    <li><span className="font-medium text-success">Green (60%+)</span> — Very likely the same event</li>
                    <li><span className="font-medium text-warning">Amber (35–59%)</span> — Might be the same, worth a look</li>
                    <li><span className="font-medium">Gray (below 35%)</span> — Probably not the same event</li>
                  </ul>
                  <p>Click the suggested title to open the Academy catalogue page and check. Then choose:</p>
                  <ul className="space-y-1 pl-3">
                    <li><span className="font-medium text-warning">Yes, same event</span> — Use this when the suggestion is correct. It properly links the two records together.</li>
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
