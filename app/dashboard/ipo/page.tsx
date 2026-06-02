import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import StatusDonut from '@/components/charts/StatusDonut'
import ChartBar from '@/components/charts/ChartBar'
import { ExternalLink, Globe, Layers, Upload } from 'lucide-react'
import PageInfo from '@/components/base/PageInfo'
import Link from 'next/link'
import { IPO_SOURCES } from '@/lib/ipo-sources'

export const dynamic = 'force-dynamic'

function groupCount(
  items: Array<Record<string, unknown>>,
  key: string
): { name: string; value: number }[] {
  const map = new Map<string, number>()
  for (const item of items) {
    const k = String(item[key] ?? 'Unknown')
    if (k === 'Unknown' || k === 'null') continue
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export default async function IPOOverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const orgId = user?.app_metadata?.org_id as string

  const [
    { data: events },
    { data: upcomingList },
    { data: lastSuccessfulRun },
    { data: lastRun },
  ] = await Promise.all([
    // Lightweight fetch for all aggregations
    supabase
      .from('events')
      .select('year,status,country,duration_days')
      .eq('ipo_id', orgId),
    // Next upcoming events
    supabase
      .from('events')
      .select('id,title,start_date,location,country,url')
      .eq('ipo_id', orgId)
      .eq('status', 'Upcoming')
      .order('start_date', { ascending: true })
      .limit(5),
    // Check if scraper has ever succeeded — determines which icon to show
    supabase
      .from('scrape_runs')
      .select('id,source')
      .eq('ipo_id', orgId)
      .eq('status', 'success')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Most recent run — if failed the sync banner is already showing so hide the source banner
    supabase
      .from('scrape_runs')
      .select('id,status')
      .eq('ipo_id', orgId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const all        = events ?? []
  const total      = all.length
  const upcoming   = all.filter(e => e.status === 'Upcoming').length
  const ongoing    = all.filter(e => e.status === 'Ongoing').length
  const past       = all.filter(e => e.status === 'Past').length
  const cancelled  = all.filter(e => e.status === 'Cancelled').length
  const postponed  = all.filter(e => e.status === 'Postponed').length

  const durations = all.map(e => e.duration_days).filter((d): d is number => d != null)
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
    : null

  const yearData = groupCount(all as never, 'year')
  const countryData = groupCount(all as never, 'country')
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  const stats = [
    { label: 'Total Events',  value: total },
    { label: 'Upcoming',      value: upcoming },
    { label: 'Ongoing',       value: ongoing },
    { label: 'Past',          value: past },
    { label: 'Avg Duration',  value: avgDuration != null ? `${avgDuration} days` : '—' },
  ]

  const source = IPO_SOURCES[orgId] ?? null

  // If the scraper has a successful run, treat it as Globe regardless of configured type.
  // If blocked/no successful run, show Upload (manual import mode).
  const scraperWorking  = !!lastSuccessfulRun && lastSuccessfulRun.source !== 'manual'
  const effectiveType   = scraperWorking ? 'html' : (source?.type ?? 'html')

  const sourceIcon =
    effectiveType === 'third_party' ? <Layers className="h-4 w-4" /> :
    effectiveType === 'blocked'     ? <Upload className="h-4 w-4" /> :
    source?.type === 'blocked' && !scraperWorking
                                    ? <Upload className="h-4 w-4" /> :
                                      <Globe className="h-4 w-4" />

  const sourceBadgeClass =
    source?.type === 'third_party' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400' :
    source?.type === 'blocked' && !scraperWorking
                                   ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400' :
                                     'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400'

  return (
    <div className="p-8 space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Overview</h1>
          <PageInfo>Your IPO event catalogue scraped from your official website. Monitor upcoming events, review sync history, and track coverage stats across all your listings.</PageInfo>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Your event catalogue at a glance</p>
      </div>

      {/* Event source banner — hidden when the sync failure banner is already visible */}
      {source && lastRun?.status !== 'failed' && (
        <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${sourceBadgeClass}`}>
          {sourceIcon}
          <div className="flex-1 min-w-0">
            <span className="font-medium">Events sourced from: </span>
            {source.platform
              ? <span>{source.platform} · <span className="text-xs opacity-75">{source.label}</span></span>
              : <span>{source.label}</span>
            }
            {source.type === 'blocked' && !scraperWorking && (
              <span className="ml-2 text-xs opacity-75">— pending Cloudflare whitelist · manual import active</span>
            )}
          </div>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map(({ label, value }) => (
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

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card style={{ overflow: 'visible' }}>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Status breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusDonut upcoming={upcoming} ongoing={ongoing} past={past} cancelled={cancelled} postponed={postponed} />
          </CardContent>
        </Card>

        <Card style={{ overflow: 'visible' }}>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Events by year</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartBar data={yearData} />
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Top countries */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top countries</CardTitle>
          </CardHeader>
          <CardContent>
            {countryData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No country data</p>
            ) : (
              <div className="space-y-2">
                {countryData.map(({ name, value }) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="w-32 truncate text-sm">{name}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${Math.round((value / (countryData[0]?.value ?? 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Next upcoming events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Next upcoming</CardTitle>
            <Link
              href="/dashboard/ipo/events?status=Upcoming"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {(upcomingList ?? []).length === 0 ? (
              <p className="px-6 pb-4 text-sm text-muted-foreground">No upcoming events</p>
            ) : (
              <div className="divide-y">
                {(upcomingList ?? []).map(event => (
                  <div key={event.id} className="flex items-start justify-between gap-3 px-6 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.start_date}
                        {event.country && ` · ${event.country}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="default" className="text-xs">Upcoming</Badge>
                      {event.url && (
                        <Link
                          href={event.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
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
