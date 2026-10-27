import Link from 'next/link'
import { Check, Clock } from 'lucide-react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buttonVariants } from '@/components/ui/button'
import StatusBadge from '@/components/base/StatusBadge'
import OrgDot from '@/components/base/OrgDot'
import { cn } from '@/lib/utils'
import { formatDay } from '@/lib/data/event-trends'
import type { ComingUpProps } from './types'

// The next upcoming events across the IPOs and Lighthouse programmes, with whether each is on the
// public calendar yet. Climate Analytics and the Academy overview both show it; the Academy's
// version also says which are in the Academy.
export default function ComingUp({ events, upcoming, viewAllHref, className }: ComingUpProps) {
  const withAcademy = events.some(e => e.inAcademy !== undefined)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Coming up</CardTitle>
        <CardDescription>
          {events.length === 0
            ? 'No upcoming events.'
            : `Next ${events.length} of ${upcoming.toLocaleString('en-GB')} upcoming events. Pending ones stay off the public calendar until approved.`}
        </CardDescription>
        <CardAction>
          <Link href={viewAllHref} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            View all upcoming
          </Link>
        </CardAction>
      </CardHeader>
      {events.length > 0 && (
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Starts</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Event</TableHead>
                {withAcademy && <TableHead>Academy</TableHead>}
                <TableHead className="pr-4">Public calendar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map(event => (
                <TableRow key={event.id}>
                  <TableCell className="pl-4 tabular-nums">{formatDay(event.start_date)}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2" title={event.org.fullName ?? undefined}><OrgDot color={event.org.color} />{event.org.name}</span>
                  </TableCell>
                  <TableCell className="w-full max-w-0">
                    {event.url ? (
                      <a href={event.url} target="_blank" rel="noopener noreferrer" title={event.title} className="block truncate hover:underline">
                        {event.title}
                      </a>
                    ) : (
                      <span title={event.title} className="block truncate">{event.title}</span>
                    )}
                  </TableCell>
                  {withAcademy && (
                    <TableCell>
                      {event.inAcademy
                        ? <StatusBadge tone="success" icon={Check}>In the Academy</StatusBadge>
                        : <span className="text-xs text-muted-foreground">Not yet</span>}
                    </TableCell>
                  )}
                  <TableCell className="pr-4">
                    {event.pending
                      ? <StatusBadge tone="warning" icon={Clock}>Pending approval</StatusBadge>
                      : <StatusBadge tone="success" icon={Check}>Approved</StatusBadge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  )
}
