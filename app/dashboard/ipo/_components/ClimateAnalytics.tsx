import Link from 'next/link'
import { Check, Clock } from 'lucide-react'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buttonVariants } from '@/components/ui/button'
import StatTile from '@/components/base/StatTile'
import StatusBadge from '@/components/base/StatusBadge'
import OrgDot from '@/components/base/OrgDot'
import { cn } from '@/lib/utils'
import { getClimateAnalytics } from '@/lib/data/climate-analytics'
import { formatDay } from '@/lib/data/event-trends'
import TrendTiles from './TrendTiles'
import EventActivity from './EventActivity'

export default async function ClimateAnalytics() {
  const { totals, trends, awaiting, next, activity, lighthouse } = await getClimateAnalytics()
  const first = next[0]
  const lighthouseWithEvents = lighthouse.filter(l => l.total > 0).length

  return (
    <div className="space-y-8">
      <TrendTiles
        trends={trends}
        nextLabel={first ? `${formatDay(first.start_date, false)}, ${first.org.name}` : null}
        trailing={
          <StatTile
            label="Awaiting approval"
            value={awaiting.total}
            aside={
              <Link href="/dashboard/ipo/approvals" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                Review
              </Link>
            }
            sub={awaiting.total === 0 ? 'Nothing waiting' : (
              <span className="flex flex-wrap items-center gap-2 pt-1">
                {awaiting.upcoming > 0 && <StatusBadge tone="warning" icon={Clock}>{awaiting.upcoming} upcoming</StatusBadge>}
                {awaiting.past > 0 && <span>{awaiting.past} already past</span>}
              </span>
            )}
          />
        }
      />

      <EventActivity
        data={activity}
        summary={`${totals.events.toLocaleString('en-GB')} events from the ${totals.ipoOrgs} IPOs and ${totals.lighthouseOrgs} Lighthouse programmes, by start date`}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Coming up</CardTitle>
            <CardDescription>
              {next.length === 0
                ? 'No upcoming events.'
                : `Next ${next.length} of ${trends.upcoming.total} upcoming events. Pending ones stay off the public calendar until approved.`}
            </CardDescription>
            <CardAction>
              <Link href="/dashboard/ipo/event-registry?status=Upcoming" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                View all upcoming
              </Link>
            </CardAction>
          </CardHeader>
          {next.length > 0 && (
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Starts</TableHead>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead className="pr-4">Public calendar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {next.map(event => (
                    <TableRow key={event.id}>
                      <TableCell className="pl-4 tabular-nums">{formatDay(event.start_date)}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2"><OrgDot color={event.org.color} />{event.org.name}</span>
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

        <Card>
          <CardHeader>
            <CardTitle>Lighthouse Activities</CardTitle>
            <CardDescription>
              {totals.lighthouse.toLocaleString('en-GB')} events from {lighthouseWithEvents} of {lighthouse.length} programmes
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y border-y">
              {lighthouse.map(({ org, total, pending }) => (
                <li key={org.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <OrgDot color={org.color} />
                    <span className="truncate">{org.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs">
                    {pending > 0 && <StatusBadge tone="warning" icon={Clock}>{pending} pending</StatusBadge>}
                    {total === 0
                      ? <span className="text-muted-foreground">No events yet</span>
                      : <span className="font-semibold tabular-nums">{total}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Link href="/dashboard/ipo/accounts" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Manage programme accounts
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
