import Link from 'next/link'
import { Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import StatusBadge from '@/components/base/StatusBadge'
import OrgDot from '@/components/base/OrgDot'
import type { LighthouseSummaryProps } from './types'

// Each Lighthouse programme's events and pending approvals. Climate Analytics and the Academy
// overview both show it; the Academy's version also counts the events in the Academy.
export default function LighthouseSummary({ programmes, footer, registryHref }: LighthouseSummaryProps) {
  const total      = programmes.reduce((sum, p) => sum + p.total, 0)
  const withEvents = programmes.filter(p => p.total > 0).length
  const inAcademy  = programmes.some(p => p.inAcademy !== undefined)
    ? programmes.reduce((sum, p) => sum + (p.inAcademy ?? 0), 0)
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lighthouse Activities</CardTitle>
        <CardDescription>
          {total.toLocaleString('en-GB')} events from {withEvents} of {programmes.length} programmes
          {inAcademy !== null && ` · ${inAcademy.toLocaleString('en-GB')} in the Academy`}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <ul className="divide-y border-y">
          {programmes.map(({ org, total, pending, inAcademy }) => (
            <li key={org.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="flex min-w-0 items-center gap-2">
                <OrgDot color={org.color} />
                <span className="min-w-0">
                  {registryHref ? (
                    <Link href={`${registryHref}?ipo=${org.id}`} className="block font-medium underline-offset-4 hover:underline">{org.name}</Link>
                  ) : (
                    <span className="block font-medium">{org.name}</span>
                  )}
                  {org.fullName && org.fullName !== org.name && (
                    <span className="block truncate text-xs text-muted-foreground">{org.fullName}</span>
                  )}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs">
                {pending > 0 && <StatusBadge tone="warning" icon={Clock}>{pending} pending</StatusBadge>}
                {total === 0
                  ? <span className="text-muted-foreground">No events yet</span>
                  : inAcademy === undefined
                    ? <span className="font-semibold tabular-nums">{total}</span>
                    : (
                      <span className="text-right tabular-nums">
                        <span className="block font-semibold">{total}</span>
                        <span className="block text-muted-foreground">{inAcademy} in the Academy</span>
                      </span>
                    )}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Link href={footer.href} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          {footer.label}
        </Link>
      </CardFooter>
    </Card>
  )
}
