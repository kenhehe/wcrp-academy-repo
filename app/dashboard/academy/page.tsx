import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import ChartBar from '@/components/charts/ChartBar'

export const dynamic = 'force-dynamic'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  success: 'default',
  running: 'secondary',
  queued:  'outline',
  failed:  'destructive',
}

export default async function AcademyOverviewPage() {
  const supabase = await createClient()

  const [
    { data: coverage },
    { data: eventsRaw },
    { data: upcomingGaps },
    { data: recentRuns },
    { data: ipos },
  ] = await Promise.all([
    supabase.from('ipo_coverage_stats').select('*'),
    // Lightweight fetch for month distribution
    supabase.from('events').select('month,status,in_academy'),
    // Next 5 upcoming events not in academy
    supabase
      .from('events')
      .select('id,title,start_date,ipo_id')
      .eq('status', 'Upcoming')
      .eq('in_academy', false)
      .order('start_date', { ascending: true })
      .limit(5),
    // Recent scrape runs
    supabase
      .from('scrape_runs')
      .select('id,ipo_id,started_at,status')
      .order('started_at', { ascending: false })
      .limit(6),
    supabase.from('ipos').select('id,name'),
  ])

  const all           = eventsRaw ?? []
  const totalEvents   = all.length
  const inAcademy     = all.filter(e => e.in_academy).length
  const missing       = totalEvents - inAcademy
  const coveragePct   = totalEvents > 0 ? ((inAcademy / totalEvents) * 100).toFixed(1) : '0.0'
  const upcomingGapsCount = all.filter(e => e.status === 'Upcoming' && !e.in_academy).length
  const missingUpcoming   = all.filter(e => !e.in_academy && e.status === 'Upcoming').length
  const missingOngoing    = all.filter(e => !e.in_academy && e.status === 'Ongoing').length
  const missingPast       = all.filter(e => !e.in_academy && e.status === 'Past').length

  // Month distribution (1=Jan … 12=Dec)
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const monthCounts = new Array(12).fill(0) as number[]
  for (const e of all) {
    if (e.month && e.month >= 1 && e.month <= 12) monthCounts[e.month - 1]++
  }
  const monthData = MONTHS.map((name, i) => ({ name, value: monthCounts[i] }))

  const ipoNameMap = new Map((ipos ?? []).map(i => [i.id, i.name]))

  const summaryStats = [
    { label: 'Total IPO Events',    value: totalEvents },
    { label: 'In Academy',          value: inAcademy },
    { label: 'Missing from Academy',value: missing },
    { label: 'Overall Coverage',    value: `${coveragePct}%` },
    { label: 'Upcoming gaps',       value: upcomingGapsCount },
  ]

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Global Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Coverage across all 7 IPOs</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {summaryStats.map(({ label, value }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Missing by status */}
      <div className="grid grid-cols-3 gap-4">
        {([
          { label: 'Missing · Upcoming', value: missingUpcoming, variant: 'text-primary' },
          { label: 'Missing · Ongoing',  value: missingOngoing,  variant: 'text-foreground' },
          { label: 'Missing · Past',     value: missingPast,     variant: 'text-muted-foreground' },
        ] as const).map(({ label, value, variant }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-semibold ${variant}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-IPO coverage + month chart */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Per-IPO coverage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(coverage ?? []).map(row => (
              <div key={row.ipo_id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm">{row.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {row.in_academy ?? 0} / {row.total_events ?? 0}
                    <span className="ml-1 font-medium">{row.coverage_pct ?? 0}%</span>
                  </span>
                </div>
                <Progress value={row.coverage_pct ?? 0} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card style={{ overflow: 'visible' }}>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Events by month</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartBar data={monthData} color="hsl(var(--primary) / 0.7)" />
          </CardContent>
        </Card>
      </div>

      {/* Action row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Upcoming gaps */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Upcoming gaps
              {upcomingGapsCount > 0 && (
                <span className="ml-2 text-xs font-normal text-destructive">{upcomingGapsCount} events</span>
              )}
            </CardTitle>
            <Link
              href="/dashboard/academy/gaps?status=Upcoming"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {(upcomingGaps ?? []).length === 0 ? (
              <p className="px-6 pb-4 text-sm text-muted-foreground">
                All upcoming events have academy coverage
              </p>
            ) : (
              <div className="divide-y">
                {(upcomingGaps ?? []).map(event => (
                  <div key={event.id} className="flex items-start justify-between gap-3 px-6 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.start_date}
                        <span className="ml-2 text-muted-foreground/70">
                          {ipoNameMap.get(event.ipo_id) ?? ''}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
                {upcomingGapsCount > 5 && (
                  <div className="px-6 py-3">
                    <Link
                      href="/dashboard/academy/gaps?status=Upcoming"
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      +{upcomingGapsCount - 5} more →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent scrape activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Recent scrape runs</CardTitle>
            <Link
              href="/dashboard/academy/health"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              System health
            </Link>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {(recentRuns ?? []).length === 0 ? (
              <p className="px-6 pb-4 text-sm text-muted-foreground">No scrape runs yet</p>
            ) : (
              <div className="divide-y">
                {(recentRuns ?? []).map(run => (
                  <div key={run.id} className="flex items-center justify-between gap-3 px-6 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{ipoNameMap.get(run.ipo_id) ?? run.ipo_id}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(run.started_at).toLocaleString('en-GB', {
                          day: '2-digit', month: 'short',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <Badge
                      variant={STATUS_VARIANT[run.status] ?? 'outline'}
                      className="text-xs capitalize flex-shrink-0"
                    >
                      {run.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
