import StatTile from '@/components/base/StatTile'
import MiniColumns from '@/components/charts/MiniColumns'
import { getCoverageRows } from '@/lib/data/coverage'
import { coveragePct, formatPct, sumCoverage } from '@/lib/data/coverage.types'
import { getCatalogueSummary, getOverviewSurveys, getUpcomingGaps } from '@/lib/data/academy-overview'
import { monthLabelsAhead } from '@/lib/data/academy-overview.types'
import { todayUtc } from '@/lib/data/event-trends'
import { formatRate } from '@/lib/data/survey-progress'

const n = (value: number) => value.toLocaleString('en-GB')

// The four headline numbers: coverage, upcoming gaps, the catalogue, surveys
export default async function OverviewTiles() {
  const [coverage, gaps, catalogue, surveys] = await Promise.all([
    getCoverageRows(), getUpcomingGaps(), getCatalogueSummary(), getOverviewSurveys(),
  ])
  const totals = sumCoverage(coverage)
  const months = monthLabelsAhead(todayUtc())
  const catalogueParts = ([
    [catalogue.upcoming, 'upcoming'], [catalogue.ongoing, 'ongoing'], [catalogue.onDemand, 'on demand'], [catalogue.past, 'past'],
  ] as const).filter(([count]) => count > 0).map(([count, label]) => `${n(count)} ${label}`)

  return (
    <section aria-label="Summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        label="Academy coverage"
        value={formatPct(coveragePct(totals))}
        sub={`${n(totals.inAcademy)} of ${n(totals.total)} IPO events are in the catalogue`}
      />
      <StatTile
        label="Upcoming gaps"
        value={n(gaps.total)}
        aside={
          <MiniColumns
            values={gaps.byMonth}
            label={`Upcoming gaps per month, ${months[0]} to ${months[months.length - 1]}: ${gaps.byMonth.map((count, i) => `${months[i]} ${count}`).join(', ')}`}
          />
        }
        sub={
          <>
            <span className="block">
              {gaps.total === 0 ? 'Every upcoming IPO event is in the Academy' : 'Upcoming IPO events not in the Academy, by month ahead'}
            </span>
            {gaps.lighthouse > 0 && (
              <span className="block">+ {n(gaps.lighthouse)} Lighthouse {gaps.lighthouse === 1 ? 'event' : 'events'}</span>
            )}
          </>
        }
      />
      <StatTile
        label="Academy catalogue"
        value={n(catalogue.total)}
        sub={catalogueParts.join(' · ') || 'No records yet'}
      />
      <StatTile
        label="Active surveys"
        value={surveys.active.length}
        sub={
          <>
            <span className="block">
              {n(surveys.totals.matched)} people answered before and after · {formatRate(surveys.totals.matchRate)} match rate
            </span>
            <span className="block">{surveys.drafts.length} draft · {surveys.closed} closed</span>
          </>
        }
      />
    </section>
  )
}
