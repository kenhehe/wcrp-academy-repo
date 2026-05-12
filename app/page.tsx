import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import StatusDonut from '@/components/charts/StatusDonut'
import ChartBar from '@/components/charts/ChartBar'
import CalendarView, { type CalendarEvent } from '@/components/calendar/CalendarView'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type IPORow   = { id: string; name: string; color_hex: string | null }
type EventAgg = { ipo_id: string; status: string; year: number | null }

const fetchSummary = cache(async () => {
  const supabase = await createClient()

  const [{ data: ipos }, { data: agg }, { data: calEvents }] = await Promise.all([
    supabase.from('ipos').select('id, name, color_hex').order('name'),
    supabase.from('events').select('ipo_id, status, year'),
    supabase.from('events').select('id, ipo_id, title, start_date, end_date, status, location, country, url').order('start_date'),
  ])

  return {
    ipos:      (ipos      ?? []) as IPORow[],
    agg:       (agg       ?? []) as EventAgg[],
    calEvents: (calEvents ?? []) as CalendarEvent[],
  }
})

export default async function HomePage() {
  const { ipos, agg, calEvents } = await fetchSummary()

  const total     = agg.length
  const upCount   = agg.filter(e => e.status === 'Upcoming').length
  const onCount   = agg.filter(e => e.status === 'Ongoing').length
  const pastCount = agg.filter(e => e.status === 'Past').length

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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Events', value: total },
            { label: 'Upcoming',     value: upCount },
            { label: 'Ongoing',      value: onCount },
            { label: 'Past',         value: pastCount },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{value}</p>
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
              <StatusDonut upcoming={upCount} ongoing={onCount} past={pastCount} />
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

        {/* Per-IPO detail cards */}
        <section>
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">By IPO</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ipoStats.map(ipo => (
              <Card key={ipo.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <span
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: ipo.color_hex ?? 'hsl(var(--primary))' }}
                    />
                    {ipo.name}
                    <span className="ml-auto text-xs font-normal text-muted-foreground tabular-nums">
                      {ipo.total} total
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-6">
                    <div>
                      <p className="text-xl font-semibold tabular-nums">{ipo.upcoming}</p>
                      <p className="text-xs text-muted-foreground">Upcoming</p>
                    </div>
                    <div>
                      <p className="text-xl font-semibold tabular-nums">{ipo.ongoing}</p>
                      <p className="text-xs text-muted-foreground">Ongoing</p>
                    </div>
                    <div>
                      <p className="text-xl font-semibold tabular-nums">{ipo.past}</p>
                      <p className="text-xs text-muted-foreground">Past</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

      </main>
    </div>
  )
}
