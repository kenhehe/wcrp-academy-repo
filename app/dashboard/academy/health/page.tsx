import Link from 'next/link'
import PageHeader from '@/components/base/PageHeader'
import StatTile from '@/components/base/StatTile'
import StatusStrip, { StatusStripLegend } from '@/components/health/StatusStrip'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  LOG_FILTERS,
  LOG_PAGE_SIZE,
  formatDuration,
  formatUtcDateTime,
  getHealthOverview,
  getRunLog,
  parseLogFilter,
  runDetails,
  runOutcome,
  type LogFilter,
} from '@/lib/data/health'
import AttentionPanel from './_components/AttentionPanel'
import ClearRunsButton from './_components/ClearRunsButton'
import CronScheduleInfo from './_components/CronScheduleInfo'
import NextRunTile from './_components/NextRunTile'
import RealtimeHealthSync from './_components/RealtimeHealthSync'
import RunAllButton from './_components/RunAllButton'
import RunNowButton from './_components/RunNowButton'
import RunStatusBadge from './_components/RunStatusBadge'
import TriggerButton from './_components/TriggerButton'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const FILTER_LABEL: Record<LogFilter, string> = {
  all:        'All runs',
  failed:     'Failed',
  unfinished: "Didn't finish",
  manual:     'Manual',
}

function logHref(filter: LogFilter, page = 1): string {
  const params = new URLSearchParams()
  if (filter !== 'all') params.set('result', filter)
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return `/dashboard/academy/health${query ? `?${query}` : ''}`
}

export default async function SystemHealthPage({ searchParams }: PageProps) {
  const sp     = await searchParams
  const filter = parseLogFilter(typeof sp.result === 'string' ? sp.result : undefined)
  const page   = Math.max(1, parseInt(typeof sp.page === 'string' ? sp.page : '1', 10) || 1)

  const [overview, log] = await Promise.all([getHealthOverview(), getRunLog(filter, page)])
  const { now, rows, attention, kpis, windowLabel } = overview

  const total      = log.counts[filter]
  const totalPages = Math.max(1, Math.ceil(total / LOG_PAGE_SIZE))
  const firstShown = total === 0 ? 0 : (page - 1) * LOG_PAGE_SIZE + 1
  const lastShown  = (page - 1) * LOG_PAGE_SIZE + log.rows.length

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <RealtimeHealthSync />

      <PageHeader
        title="System Health"
        info={
          <>
            Live status of the {kpis.total} IPO scrapers. Each runs twice a day; a run that finds nothing
            new is recorded as No change. Preview shows what a run would change without saving it, and
            Run now starts a full run straight away.
          </>
        }
        description={`${kpis.total} IPO scrapers run twice a day, 15 minutes apart. All times are UTC.`}
        actions={
          <>
            <CronScheduleInfo />
            <RunAllButton />
          </>
        }
      />

      <AttentionPanel items={attention} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Scrapers healthy"
          value={`${kpis.healthy} of ${kpis.total}`}
          sub={attention.length === 0 ? 'Nothing needs attention' : `${attention.length} need attention`}
        />
        <NextRunTile initialNow={now} />
        <StatTile
          label="Runs, last 7 days"
          value={kpis.runs7d}
          sub={`${kpis.failed7d} failed, ${kpis.stuck7d} didn't finish`}
        />
        <StatTile
          label="New events found"
          value={kpis.newEvents}
          sub={`in 60 days${kpis.lastNewEvents ? `. Last new: ${kpis.lastNewEvents}` : ''}`}
        />
      </div>

      <Card className="gap-0 pb-0">
        <CardHeader className="flex flex-wrap items-start justify-between gap-3 pb-4">
          <div className="space-y-1">
            <CardTitle>Scraper history</CardTitle>
            <CardDescription>One bar per day, {windowLabel}. Hover a bar to see its date.</CardDescription>
          </div>
          <StatusStripLegend />
        </CardHeader>
        <ul>
          {rows.map(row => (
            <li key={row.ipo.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t px-4 py-3.5">
              <div className="flex w-40 shrink-0 flex-col items-start gap-1.5">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: row.ipo.color_hex ?? 'var(--muted-foreground)' }}
                  />
                  {row.ipo.name}
                </span>
                <RunStatusBadge outcome={row.latestOutcome} />
              </div>
              <StatusStrip days={row.strip} label={row.stripLabel} className="min-w-60 flex-[1_1_360px]" />
              <div className="w-28 shrink-0 text-sm">
                <p className="text-xs text-muted-foreground">Last success</p>
                <p className="font-medium">{row.lastSuccessDate ?? 'Never'}</p>
                <p className="text-xs text-muted-foreground">{row.lastSuccessNote}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <TriggerButton ipoId={row.ipo.id} ipoName={row.ipo.name} />
                <RunNowButton ipoId={row.ipo.id} ipoName={row.ipo.name} />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card id="run-log" className="scroll-mt-4 gap-0">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <CardTitle>Run log</CardTitle>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-semibold text-info">
                <span className="size-1.5 rounded-full bg-current motion-safe:animate-pulse" aria-hidden="true" />
                Live
              </span>
            </div>
            <CardDescription>
              Newest first. Showing {firstShown}–{lastShown} of {total.toLocaleString('en-GB')}
              {filter === 'all' ? ' runs.' : ' matching runs.'}
            </CardDescription>
          </div>
          <nav aria-label="Filter runs" className="flex flex-wrap gap-2">
            {LOG_FILTERS.map(f => (
              <Link
                key={f}
                href={logHref(f)}
                scroll={false}
                aria-current={f === filter ? 'page' : undefined}
                className={cn(buttonVariants({ variant: f === filter ? 'default' : 'outline', size: 'sm' }))}
              >
                {FILTER_LABEL[f]}
                <span className="tabular-nums opacity-75">{log.counts[f].toLocaleString('en-GB')}</span>
              </Link>
            ))}
          </nav>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="pl-4">IPO</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Result</TableHead>
              <TableHead className="text-right">Events</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead className="pr-4">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {log.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No runs match this filter
                </TableCell>
              </TableRow>
            ) : (
              log.rows.map(run => {
                const ipo     = rows.find(r => r.ipo.id === run.ipo_id)?.ipo
                const outcome = runOutcome(run, log.now)
                return (
                  <TableRow key={run.id}>
                    <TableCell className="pl-4">
                      <span className="flex items-center gap-2 font-medium">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: ipo?.color_hex ?? 'var(--muted-foreground)' }}
                        />
                        {ipo?.name ?? run.ipo_id}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{formatUtcDateTime(run.started_at)}</TableCell>
                    <TableCell>
                      <span className={cn(
                        'inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium',
                        run.source === 'manual' ? 'bg-info-soft text-info' : 'bg-muted text-muted-foreground',
                      )}>
                        {run.source === 'manual' ? 'Manual' : run.source === 'cron' ? 'Cron' : 'Auto'}
                      </span>
                    </TableCell>
                    <TableCell><RunStatusBadge outcome={outcome} /></TableCell>
                    <TableCell className="text-right tabular-nums">
                      {outcome === 'found' ? `${run.events_found ?? 0} (${run.events_new ?? 0} new)` : outcome === 'failed' ? '0' : '–'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatDuration(run)}</TableCell>
                    <TableCell className="min-w-72 whitespace-normal pr-4 text-muted-foreground">
                      {runDetails(run, log.now)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        <CardFooter className="flex-wrap justify-between gap-3">
          <ClearRunsButton />
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
            {page > 1 && (
              <Link href={logHref(filter, page - 1)} scroll={false} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={logHref(filter, page + 1)} scroll={false} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Next
              </Link>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Deploy fingerprint: confirms which version is live */}
      <p className="text-xs text-muted-foreground/50 text-right">
        deploy: {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local'}
      </p>
    </div>
  )
}
