import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type IPORow   = { id: string; name: string; color_hex: string | null }
type EventAgg = { ipo_id: string; status: string }
type EventRow = { id: string; title: string; start_date: string; country: string | null; ipo_id: string }

const fetchSummary = cache(async () => {
  const supabase = await createClient()

  const [
    { data: ipos },
    { data: agg },
    { data: upcoming },
    { data: recentPast },
  ] = await Promise.all([
    supabase.from('ipos').select('id, name, color_hex').order('name'),
    supabase.from('events').select('ipo_id, status'),
    supabase
      .from('events')
      .select('id, title, start_date, country, ipo_id')
      .eq('status', 'Upcoming')
      .order('start_date', { ascending: true })
      .limit(10),
    supabase
      .from('events')
      .select('id, title, start_date, country, ipo_id')
      .eq('status', 'Past')
      .order('start_date', { ascending: false })
      .limit(8),
  ])

  return {
    ipos:       (ipos       ?? []) as IPORow[],
    agg:        (agg        ?? []) as EventAgg[],
    upcoming:   (upcoming   ?? []) as EventRow[],
    recentPast: (recentPast ?? []) as EventRow[],
  }
})

const STATUS_COLORS: Record<string, string> = {
  Upcoming: 'default',
  Ongoing:  'secondary',
  Past:     'outline',
}

export default async function HomePage() {
  const { ipos, agg, upcoming, recentPast } = await fetchSummary()

  const ipoMap = Object.fromEntries(ipos.map(i => [i.id, i]))

  const total    = agg.length
  const upCount  = agg.filter(e => e.status === 'Upcoming').length
  const onCount  = agg.filter(e => e.status === 'Ongoing').length
  const pastCount = agg.filter(e => e.status === 'Past').length

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

        {/* Per-IPO cards */}
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

        {/* Events lists */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

          {/* Upcoming */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">
              Upcoming Events
            </h2>
            <Card>
              <CardContent className="px-0 pb-0">
                {upcoming.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-muted-foreground">No upcoming events</p>
                ) : (
                  <div className="divide-y">
                    {upcoming.map(event => (
                      <div key={event.id} className="flex items-start justify-between gap-3 px-6 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{event.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {event.start_date}
                            {event.country && ` · ${event.country}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {ipoMap[event.ipo_id] && (
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: ipoMap[event.ipo_id].color_hex ?? 'hsl(var(--primary))' }}
                            />
                          )}
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {ipoMap[event.ipo_id]?.name ?? event.ipo_id}
                          </span>
                          <Badge variant={STATUS_COLORS['Upcoming'] as 'default'} className="text-xs">
                            Upcoming
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Recent past */}
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">
              Recent Past Events
            </h2>
            <Card>
              <CardContent className="px-0 pb-0">
                {recentPast.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-muted-foreground">No past events</p>
                ) : (
                  <div className="divide-y">
                    {recentPast.map(event => (
                      <div key={event.id} className="flex items-start justify-between gap-3 px-6 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{event.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {event.start_date}
                            {event.country && ` · ${event.country}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {ipoMap[event.ipo_id] && (
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: ipoMap[event.ipo_id].color_hex ?? 'hsl(var(--primary))' }}
                            />
                          )}
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {ipoMap[event.ipo_id]?.name ?? event.ipo_id}
                          </span>
                          <Badge variant="outline" className="text-xs">Past</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

        </div>
      </main>
    </div>
  )
}
