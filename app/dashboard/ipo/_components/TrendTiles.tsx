import type { ReactNode } from 'react'
import StatTile from '@/components/base/StatTile'
import Sparkline from '@/components/charts/Sparkline'
import MiniColumns from '@/components/charts/MiniColumns'
import { describeChange, formatDayMonth, monthName, type Trends } from '@/lib/data/event-trends'

interface TrendTilesProps {
  trends:    Trends
  nextLabel: string | null   // "26 Oct, ESMO"
  leading?:  ReactNode       // an extra tile before the three trend tiles
  trailing?: ReactNode       // an extra tile after them
}

// "So far this year", "This month" and "Upcoming", shared by Climate Analytics and the per-org overview
export default function TrendTiles({ trends, nextLabel, leading, trailing }: TrendTilesProps) {
  const { today, soFar, months, monthLastYear, upcoming } = trends
  const thisYear  = soFar[soFar.length - 1]
  const lastYear  = soFar[soFar.length - 2]
  const thisMonth = months[months.length - 1]
  const month     = monthName(Number(today.slice(5, 7)) - 1, true)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {leading}
      <StatTile
        label="Events so far this year"
        value={thisYear.count}
        change={{
          ...describeChange(thisYear.count, lastYear.count),
          comparison: `vs same date in ${lastYear.year} (${lastYear.count})`,
        }}
        aside={
          <Sparkline
            values={soFar.map(p => p.count)}
            label={`Events from 1 January to ${formatDayMonth(today)} each year: ${soFar.map(p => `${p.year}, ${p.count}`).join('; ')}`}
          />
        }
      />
      <StatTile
        label="Events this month"
        value={thisMonth.count}
        change={{
          ...describeChange(thisMonth.count, monthLastYear),
          comparison: `vs ${month} ${lastYear.year} (${monthLastYear})`,
        }}
        aside={
          <Sparkline
            values={months.map(m => m.count)}
            label={`Events per month: ${months.map(m => `${m.label}, ${m.count}`).join('; ')}`}
          />
        }
      />
      <StatTile
        label="Upcoming"
        value={upcoming.total}
        sub={nextLabel ? `Next: ${nextLabel}` : 'Nothing scheduled yet'}
        aside={
          <MiniColumns
            values={upcoming.byMonth.map(m => m.count)}
            label={`Upcoming events per month: ${upcoming.byMonth.map(m => `${m.label}, ${m.count}`).join('; ')}`}
          />
        }
      />
      {trailing}
    </div>
  )
}
