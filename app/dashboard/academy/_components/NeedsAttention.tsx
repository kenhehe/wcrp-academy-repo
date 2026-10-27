import Link from 'next/link'
import { ArrowRight, CircleCheck, CircleX, Copy, TriangleAlert, type LucideIcon } from 'lucide-react'
import OrgDot from '@/components/base/OrgDot'
import StatusBadge from '@/components/base/StatusBadge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getAttention, getUpcomingGaps } from '@/lib/data/academy-overview'
import { dayBlock, daysUntil, daysUntilLabel, type AlertTone } from '@/lib/data/academy-overview.types'
import { todayUtc } from '@/lib/data/event-trends'

const TONE: Record<AlertTone, { box: string; text: string; icon: LucideIcon }> = {
  danger:  { box: 'bg-danger-soft',  text: 'text-danger',  icon: CircleX },
  warning: { box: 'bg-warning-soft', text: 'text-warning', icon: TriangleAlert },
  info:    { box: 'bg-info-soft',    text: 'text-info',    icon: Copy },
}

const SOON_DAYS = 7   // gaps starting within a week get a warning badge

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

// What to act on next: the soonest upcoming IPO events missing from the Academy, and alerts
// (scrapers that need a look, duplicate pairs waiting for review)
export default async function NeedsAttention() {
  const [gaps, alerts] = await Promise.all([getUpcomingGaps(), getAttention()])
  const today = todayUtc()
  const more  = gaps.total - gaps.next.length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
        <CardDescription>What to act on next, most urgent first.</CardDescription>
      </CardHeader>
      <CardContent className={cn('grid gap-6', alerts.length > 0 && 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]')}>
        <section aria-labelledby="gaps-title" className="min-w-0">
          <h3 id="gaps-title" className="mb-2 text-sm font-semibold text-muted-foreground">Upcoming events missing from the Academy</h3>
          {gaps.next.length === 0 ? (
            <StatusBadge tone="success" icon={CircleCheck}>Every upcoming IPO event is in the Academy</StatusBadge>
          ) : (
            <>
              <ul className="divide-y border-y">
                {gaps.next.map(e => {
                  const block = dayBlock(e.start_date, e.end_date)
                  const days  = daysUntil(e.start_date, today)
                  return (
                    <li key={e.id} className="flex items-center gap-3 py-2.5">
                      <div className="w-14 shrink-0 rounded-lg bg-muted py-1 text-center">
                        <span className="block text-base leading-tight font-semibold tabular-nums">{block.day}</span>
                        <span className="block text-[11px] font-medium text-muted-foreground uppercase">{block.month}</span>
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        {e.url ? (
                          <a href={e.url} target="_blank" rel="noopener noreferrer" title={e.title} className="block truncate font-medium hover:underline">
                            {e.title}
                          </a>
                        ) : (
                          <span title={e.title} className="block truncate font-medium">{e.title}</span>
                        )}
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5" title={e.org.fullName ?? undefined}>
                            <OrgDot color={e.org.color} />
                            {e.org.name}
                          </span>
                          {e.location && <span className="truncate">{capitalise(e.location)}</span>}
                        </span>
                      </div>
                      {days <= SOON_DAYS
                        ? <StatusBadge tone="warning" className="shrink-0">{daysUntilLabel(days)}</StatusBadge>
                        : <span className="shrink-0 text-xs text-muted-foreground">{daysUntilLabel(days)}</span>}
                    </li>
                  )
                })}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-sm">
                <span className="text-muted-foreground">
                  {more > 0 ? `${more} more upcoming ${more === 1 ? 'event is' : 'events are'} missing` : 'That’s all of them'}
                </span>
                <Link href="/dashboard/academy/gaps?status=Upcoming#missing" className="inline-flex min-h-11 items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">
                  Open Gap Analysis
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </>
          )}
        </section>

        {alerts.length > 0 && (
          <ul aria-label="Alerts" className="space-y-3">
            {alerts.map(alert => {
              const tone = TONE[alert.tone]
              const Icon = tone.icon
              return (
                <li key={alert.key} className={cn('flex gap-3 rounded-lg p-3.5', tone.box)}>
                  <Icon className={cn('mt-0.5 size-4.5 shrink-0', tone.text)} aria-hidden="true" />
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold">{alert.title}</p>
                    <p className="text-sm">{alert.message}</p>
                    <Link href={alert.href} className={cn('inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline', tone.text)}>
                      {alert.linkLabel}
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
