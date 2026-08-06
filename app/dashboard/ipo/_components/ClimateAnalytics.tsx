import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import EventsStackedBar from '@/components/charts/EventsStackedBar'
import { ClipboardCheck } from 'lucide-react'

// Fallback colours for LHA programmes that have no color_hex in the DB
const LHA_FALLBACK = ['#f59e0b', '#d97706', '#ea580c', '#f97316', '#b45309', '#92400e']

export default async function ClimateAnalytics() {
  const db = createAdminClient()

  const [{ data: ipos }, { data: lighthouses }] = await Promise.all([
    db.from('ipos').select('id,name,color_hex').eq('type', 'ipo').order('name'),
    db.from('ipos').select('id,name,color_hex').eq('type', 'lighthouse').order('name'),
  ])

  const ipoIds = (ipos ?? []).map(i => i.id)
  const lhaIds = (lighthouses ?? []).map(i => i.id)

  const [
    { data: ipoEvents },
    { data: lhaEvents },
    { data: lhaPending },
    { data: lhaApproved },
    { data: pendingList },
  ] = await Promise.all([
    db
      .from('events')
      .select('ipo_id,status,year,month')
      .in('ipo_id', ipoIds),
    db
      .from('events')
      .select('ipo_id,year,month')
      .in('ipo_id', lhaIds),
    db
      .from('events')
      .select('ipo_id')
      .in('ipo_id', lhaIds)
      .eq('approval_status', 'pending'),
    db
      .from('events')
      .select('ipo_id')
      .in('ipo_id', lhaIds)
      .eq('approval_status', 'approved'),
    db
      .from('events')
      .select('id,title,start_date,ipo_id,status')
      .in('ipo_id', lhaIds)
      .eq('approval_status', 'pending')
      .order('start_date', { ascending: true })
      .limit(8),
  ])

  const ipoAll      = ipoEvents ?? []
  const totalIpo    = ipoAll.length
  const ipoUpcoming = ipoAll.filter(e => e.status === 'Upcoming').length

  const totalPending  = (lhaPending  ?? []).length
  const totalApproved = (lhaApproved ?? []).length
  const totalLha      = totalPending + totalApproved

  // Per-IPO counts (for the progress bars)
  const ipoCountMap = new Map<string, { upcoming: number; ongoing: number; total: number }>()
  for (const e of ipoAll) {
    if (!ipoCountMap.has(e.ipo_id)) {
      ipoCountMap.set(e.ipo_id, { upcoming: 0, ongoing: 0, total: 0 })
    }
    const c = ipoCountMap.get(e.ipo_id)!
    c.total++
    if      (e.status === 'Upcoming') c.upcoming++
    else if (e.status === 'Ongoing')  c.ongoing++
  }

  // LHA per-programme
  const lhaPendingByOrg  = new Map<string, number>()
  const lhaApprovedByOrg = new Map<string, number>()
  for (const e of lhaPending  ?? []) lhaPendingByOrg.set(e.ipo_id,  (lhaPendingByOrg.get(e.ipo_id)  ?? 0) + 1)
  for (const e of lhaApproved ?? []) lhaApprovedByOrg.set(e.ipo_id, (lhaApprovedByOrg.get(e.ipo_id) ?? 0) + 1)

  const lhaNameMap = new Map((lighthouses ?? []).map(i => [i.id, i.name]))

  // Chart series
  const ipoOrgs = (ipos ?? []).map(i => ({
    id:    i.id,
    name:  i.name,
    color: i.color_hex ?? '#6b7280',
  }))

  const lhaOrgs = (lighthouses ?? []).map((i, idx) => ({
    id:    i.id,
    name:  i.name,
    color: i.color_hex ?? LHA_FALLBACK[idx % LHA_FALLBACK.length],
  }))

  const ipoEventsForChart = ipoAll.map(e => ({
    org_id: e.ipo_id,
    year:   e.year   as number | null,
    month:  e.month  as number | null,
  }))

  const lhaEventsForChart = (lhaEvents ?? []).map(e => ({
    org_id: e.ipo_id,
    year:   e.year   as number | null,
    month:  e.month  as number | null,
  }))

  return (
    <div className="space-y-8">

      {/* Header stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {([
          { label: 'Total IPO Events',        value: totalIpo },
          { label: 'IPO · Upcoming',           value: ipoUpcoming },
          { label: 'Total LHA Events',         value: totalLha },
          { label: 'LHA · Pending Approval',   value: totalPending },
        ] as const).map(({ label, value }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-semibold ${label === 'LHA · Pending Approval' && value > 0 ? 'text-amber-600' : ''}`}>
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Combined stacked bar chart — IPO + LHA */}
      <Card style={{ overflow: 'visible' }}>
        <CardHeader>
          <CardTitle className="text-sm font-medium">IPO + Lighthouse Activity events</CardTitle>
          <p className="text-xs text-muted-foreground">All events by year / month, per IPO and LHA programme</p>
        </CardHeader>
        <CardContent>
          <EventsStackedBar
            orgs={[...ipoOrgs, ...lhaOrgs]}
            events={[...ipoEventsForChart, ...lhaEventsForChart]}
            height={260}
          />
        </CardContent>
      </Card>

      {/* Per-IPO breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Events per IPO</CardTitle>
          <p className="text-xs text-muted-foreground">Scraped events across all 7 IPOs</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {(ipos ?? []).map(ipo => {
            const c = ipoCountMap.get(ipo.id) ?? { upcoming: 0, ongoing: 0, total: 0 }
            const maxTotal = Math.max(...(ipos ?? []).map(i => ipoCountMap.get(i.id)?.total ?? 0), 1)
            return (
              <div key={ipo.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {ipo.color_hex && (
                      <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ipo.color_hex }} />
                    )}
                    <span className="text-sm">{ipo.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs tabular-nums text-muted-foreground">
                    <span className="text-primary font-medium">{c.upcoming} upcoming</span>
                    <span>{c.ongoing} ongoing</span>
                    <span className="font-medium">{c.total} total</span>
                  </div>
                </div>
                <Progress value={c.total > 0 ? Math.round((c.total / maxTotal) * 100) : 0} className="h-1.5" />
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* LHA section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Per-programme breakdown */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium">Lighthouse Activities</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Community calendar submissions</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {totalPending > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                  {totalPending} pending
                </span>
              )}
              <span className="rounded-full bg-green-100 px-2.5 py-1 font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
                {totalApproved} approved
              </span>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {(lighthouses ?? []).length === 0 ? (
              <p className="px-6 pb-4 text-sm text-muted-foreground">No LHA programmes configured</p>
            ) : (
              <div className="divide-y">
                {(lighthouses ?? []).map(lha => {
                  const pending  = lhaPendingByOrg.get(lha.id)  ?? 0
                  const approved = lhaApprovedByOrg.get(lha.id) ?? 0
                  return (
                    <div key={lha.id} className="flex items-center justify-between gap-3 px-6 py-3">
                      <span className="text-sm truncate">{lha.name}</span>
                      <div className="flex items-center gap-3 text-xs shrink-0">
                        {pending > 0 && (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">{pending} pending</span>
                        )}
                        {approved > 0 && (
                          <span className="text-green-600 dark:text-green-400 font-medium">{approved} approved</span>
                        )}
                        {pending === 0 && approved === 0 && (
                          <span className="text-muted-foreground">no events</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending LHA events list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium">Pending approvals</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">LHA events awaiting review</p>
            </div>
            <Link
              href="/dashboard/ipo/approvals"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              Review all
            </Link>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {(pendingList ?? []).length === 0 ? (
              <p className="px-6 pb-4 text-sm text-muted-foreground">No pending events — all clear</p>
            ) : (
              <div className="divide-y">
                {(pendingList ?? []).map(event => (
                  <div key={event.id} className="flex items-start justify-between gap-3 px-6 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.start_date}
                        <span className="ml-2">{lhaNameMap.get(event.ipo_id) ?? event.ipo_id}</span>
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-xs shrink-0 border-amber-300 text-amber-700 dark:text-amber-400"
                    >
                      pending
                    </Badge>
                  </div>
                ))}
                {totalPending > 8 && (
                  <div className="px-6 py-3">
                    <Link
                      href="/dashboard/ipo/approvals"
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      +{totalPending - 8} more →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
