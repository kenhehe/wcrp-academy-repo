import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CalendarView, { type CalendarEvent } from '@/components/calendar/CalendarView'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type IPORow = { id: string; name: string; color_hex: string | null }

const fetchSummary = cache(async () => {
  const supabase = await createClient()

  const [{ data: ipos }, { data: calEvents }] = await Promise.all([
    supabase.from('ipos').select('id, name, color_hex').order('name'),
    supabase
      .from('events')
      .select('id, ipo_id, title, start_date, end_date, status, location, country, url')
      .eq('approval_status', 'approved')
      .order('start_date'),
  ])

  return {
    ipos:      (ipos      ?? []) as IPORow[],
    calEvents: (calEvents ?? []) as CalendarEvent[],
  }
})

export default async function HomePage() {
  const { ipos, calEvents } = await fetchSummary()

  const total          = calEvents.length
  const upCount        = calEvents.filter(e => e.status === 'Upcoming').length
  const onCount        = calEvents.filter(e => e.status === 'Ongoing').length
  const pastCount      = calEvents.filter(e => e.status === 'Past').length
  const cancelledCount = calEvents.filter(e => e.status === 'Cancelled').length
  const postponedCount = calEvents.filter(e => e.status === 'Postponed').length

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

      </main>
    </div>
  )
}
