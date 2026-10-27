import Link from 'next/link'
import { Clock } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import StatTile from '@/components/base/StatTile'
import StatusBadge from '@/components/base/StatusBadge'
import { cn } from '@/lib/utils'
import { getClimateAnalytics } from '@/lib/data/climate-analytics'
import { formatDay } from '@/lib/data/event-trends'
import TrendTiles from './TrendTiles'
import EventActivity from '@/components/charts/EventActivity'
import ComingUp from '@/components/events/ComingUp'
import LighthouseSummary from '@/components/events/LighthouseSummary'

export default async function ClimateAnalytics() {
  const { totals, trends, awaiting, next, activity, lighthouse } = await getClimateAnalytics()
  const first = next[0]

  return (
    <div className="space-y-8">
      <TrendTiles
        trends={trends}
        nextLabel={first ? `${formatDay(first.start_date, false)}, ${first.org.name}` : null}
        trailing={
          <StatTile
            label="Awaiting approval"
            value={awaiting.total}
            aside={
              <Link href="/dashboard/ipo/approvals" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                Review
              </Link>
            }
            sub={awaiting.total === 0 ? 'Nothing waiting' : (
              <span className="flex flex-wrap items-center gap-2 pt-1">
                {awaiting.upcoming > 0 && <StatusBadge tone="warning" icon={Clock}>{awaiting.upcoming} upcoming</StatusBadge>}
                {awaiting.past > 0 && <span>{awaiting.past} already past</span>}
              </span>
            )}
          />
        }
      />

      <EventActivity
        data={activity}
        summary={`${totals.events.toLocaleString('en-GB')} events from the ${totals.ipoOrgs} IPOs and ${totals.lighthouseOrgs} Lighthouse programmes, by start date`}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <ComingUp
          className="xl:col-span-2"
          events={next}
          upcoming={trends.upcoming.total}
          viewAllHref="/dashboard/ipo/event-registry?status=Upcoming"
        />
        <LighthouseSummary
          programmes={lighthouse}
          footer={{ href: '/dashboard/ipo/accounts', label: 'Manage programme accounts' }}
        />
      </div>
    </div>
  )
}
