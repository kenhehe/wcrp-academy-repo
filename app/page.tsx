import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import StatusDonut from '@/components/charts/StatusDonut'
import ChartBar from '@/components/charts/ChartBar'
import CalendarView, { type CalendarEvent } from '@/components/calendar/CalendarView'
import { classifyCountry, COUNTRY_NORMALIZE } from '@/lib/geo'
import Link from 'next/link'
import IpoStatusGrid from '@/components/ipo/IpoStatusGrid'

export const dynamic = 'force-dynamic'

type IPORow   = { id: string; name: string; color_hex: string | null }
type EventAgg = { ipo_id: string; status: string; year: number | null }

type ScrapeRunRow = { ipo_id: string; status: string; error_message: string | null; started_at: string }

const fetchSummary = cache(async () => {
  const supabase = await createClient()

  const [{ data: ipos }, { data: agg }, { data: calEvents }, { data: recentRuns }] = await Promise.all([
    supabase.from('ipos').select('id, name, color_hex').order('name'),
    supabase.from('events').select('ipo_id, status, year'),
    supabase.from('events').select('id, ipo_id, title, start_date, end_date, status, location, country, url').order('start_date'),
    supabase.from('scrape_runs').select('ipo_id, status, error_message, started_at').order('started_at', { ascending: false }).limit(50),
  ])

  // Latest run per IPO
  const latestRunMap = new Map<string, ScrapeRunRow>()
  for (const run of (recentRuns ?? []) as ScrapeRunRow[]) {
    if (!latestRunMap.has(run.ipo_id)) latestRunMap.set(run.ipo_id, run)
  }

  return {
    ipos:       (ipos      ?? []) as IPORow[],
    agg:        (agg       ?? []) as EventAgg[],
    calEvents:  (calEvents ?? []) as CalendarEvent[],
    scrapeRuns: [...latestRunMap.values()],
  }
})

export default async function HomePage() {
  const { ipos, agg, calEvents, scrapeRuns } = await fetchSummary()

  const total          = agg.length
  const upCount        = agg.filter(e => e.status === 'Upcoming').length
  const onCount        = agg.filter(e => e.status === 'Ongoing').length
  const pastCount      = agg.filter(e => e.status === 'Past').length
  const cancelledCount = agg.filter(e => e.status === 'Cancelled').length
  const postponedCount = agg.filter(e => e.status === 'Postponed').length

  // Events by year (all IPOs combined)
  const yearMap = new Map<string, number>()
  for (const e of agg) {
    if (e.year != null) {
      const k = String(e.year)
      yearMap.set(k, (yearMap.get(k) ?? 0) + 1)
    }
  }
  const yearData = [...yearMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Per-IPO stats
  const ipoStats = ipos.map(ipo => {
    const rows = agg.filter(e => e.ipo_id === ipo.id)
    return {
      ...ipo,
      total:    rows.length,
      upcoming: rows.filter(e => e.status === 'Upcoming').length,
      ongoing:  rows.filter(e => e.status === 'Ongoing').length,
      past:     rows.filter(e => e.status === 'Past').length,
    }
  })

  // Geographic breakdown
  const geoCount = { North: 0, South: 0, Other: 0 }
  const countryMap = new Map<string, number>()
  for (const e of calEvents) {
    const cat = classifyCountry(e.country)
    geoCount[cat]++
    if (cat !== 'Other' && e.country) {
      const name = COUNTRY_NORMALIZE[e.country] ?? e.country
      countryMap.set(name, (countryMap.get(name) ?? 0) + 1)
    }
  }
  const topCountriesData = [...countryMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12)

  // IPO comparison bar data (sorted highest first)
  const ipoBarData = ipoStats
    .filter(i => i.total > 0)
    .map(i => ({ name: i.name, value: i.total }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">WCRP Events</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Public event catalogue across all IPOs</p>
        </div>
        <Link
          href="/login"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign in →
        </Link>
      </header>

      <main className="px-8 py-10 space-y-10 max-w-7xl mx-auto">

        {/* Global stat row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Total Events', value: total,          color: '' },
            { label: 'Upcoming',     value: upCount,        color: '' },
            { label: 'Ongoing',      value: onCount,        color: '' },
            { label: 'Past',         value: pastCount,      color: '' },
            { label: 'Cancelled',    value: cancelledCount, color: 'text-red-500' },
            { label: 'Postponed',    value: postponedCount, color: 'text-orange-500' },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Calendar */}
        <CalendarView events={calEvents} ipos={ipos} />

        {/* Status donut + Events by year */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card style={{ overflow: 'visible' }}>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Status breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusDonut upcoming={upCount} ongoing={onCount} past={pastCount} cancelled={cancelledCount} postponed={postponedCount} />
            </CardContent>
          </Card>

          <Card style={{ overflow: 'visible' }}>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Events by year</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartBar data={yearData} height={220} />
            </CardContent>
          </Card>
        </div>

        {/* Events per IPO */}
        <Card style={{ overflow: 'visible' }}>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Events per IPO</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartBar data={ipoBarData} height={220} />
          </CardContent>
        </Card>

        {/* Geographic breakdown */}
        <section>
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">Geographic Breakdown</h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Global North vs South</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[
                    { label: 'Global North', value: geoCount.North,  color: '#2563eb' },
                    { label: 'Global South', value: geoCount.South,  color: '#16a34a' },
                    { label: 'Virtual / Unknown', value: geoCount.Other, color: '#94a3b8' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <p className="text-2xl font-semibold tabular-nums" style={{ color }}>{value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Global North', value: geoCount.North, color: '#2563eb' },
                    { label: 'Global South', value: geoCount.South, color: '#16a34a' },
                  ].map(({ label, value, color }) => {
                    const classified = geoCount.North + geoCount.South
                    const pct = classified > 0 ? Math.round(value / classified * 100) : 0
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>{label}</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card style={{ overflow: 'visible' }}>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Top countries</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartBar data={topCountriesData} height={260} />
              </CardContent>
            </Card>

          </div>
        </section>

        {/* Per-IPO detail cards */}
        <section>
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">By IPO</h2>
          <IpoStatusGrid ipoStats={ipoStats} scrapeRuns={scrapeRuns} />
        </section>

      </main>
    </div>
  )
}
