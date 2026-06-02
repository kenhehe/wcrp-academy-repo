import Link from 'next/link'
import PageInfo from '@/components/base/PageInfo'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import TriggerButton from './_components/TriggerButton'
import RunAllButton from './_components/RunAllButton'
import ClearRunsButton from './_components/ClearRunsButton'
import RealtimeHealthSync from './_components/RealtimeHealthSync'
import CronScheduleInfo from './_components/CronScheduleInfo'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 10

interface PageProps {
  searchParams: Promise<{ page?: string }>
}

interface ScrapeRun {
  id: string
  ipo_id: string
  started_at: string
  finished_at: string | null
  status: string
  events_found: number | null
  error_message: string | null
  source: string | null
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  success:  'default',
  running:  'secondary',
  queued:   'outline',
  failed:   'destructive',
  skipped:  'outline',
  partial:  'secondary',
}

const STATUS_LABEL: Record<string, string> = {
  skipped: 'No change',
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function duration(start: string, end: string | null) {
  if (!end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export default async function SystemHealthPage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))

  let ipos:        { id: string; name: string; color_hex: string | null }[] = []
  let allRuns:     ScrapeRun[] = []   // recent 100 — used for per-IPO latest computation
  let pageRuns:    ScrapeRun[] = []   // current page slice — displayed in recent runs table
  let totalRuns:   number = 0

  try {
    console.log('[health] page render start — page:', page)

    // createAdminClient() inside try-catch: if JWT parsing or env vars throw,
    // the error is caught here instead of crashing the RSC stream.
    const supabase = createAdminClient()
    console.log('[health] admin client created OK')

    const [iposResult, allRunsResult, pageRunsResult] = await Promise.all([
      supabase.from('ipos').select('id,name,color_hex').order('name'),
      // Full recent batch for latest-per-IPO computation
      supabase
        .from('scrape_runs')
        .select('id,ipo_id,started_at,finished_at,status,events_found,error_message,source')
        .order('started_at', { ascending: false })
        .limit(100),
      // Paginated slice for the recent runs table
      supabase
        .from('scrape_runs')
        .select('id,ipo_id,started_at,finished_at,status,events_found,error_message,source', { count: 'exact' })
        .order('started_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    ])

    if (iposResult.error)    console.error('[health] ipos query error:',      iposResult.error.message)
    if (allRunsResult.error) console.error('[health] all_runs query error:',  allRunsResult.error.message)
    if (pageRunsResult.error) console.error('[health] page_runs query error:', pageRunsResult.error.message)

    ipos     = (iposResult.data    ?? []) as typeof ipos
    allRuns  = (allRunsResult.data ?? []) as ScrapeRun[]
    pageRuns = (pageRunsResult.data ?? []) as ScrapeRun[]
    totalRuns = pageRunsResult.count ?? 0

    console.log('[health] data OK — ipos:', ipos.length, 'allRuns:', allRuns.length, 'pageRuns:', pageRuns.length, 'total:', totalRuns)
  } catch (err) {
    console.error('[health] data fetch failed:', err)
  }

  const runs = allRuns   // alias for summary stats below

  // Latest run per IPO — plus latest manual run separately
  const latestPerIpo      = new Map<string, ScrapeRun>()
  const lastSuccessPerIpo = new Map<string, ScrapeRun>()
  const lastManualPerIpo  = new Map<string, ScrapeRun>()
  for (const run of runs) {
    if (!latestPerIpo.has(run.ipo_id)) latestPerIpo.set(run.ipo_id, run)
    if (run.source === 'manual' && !lastManualPerIpo.has(run.ipo_id)) {
      lastManualPerIpo.set(run.ipo_id, run)
    }
    if (!lastSuccessPerIpo.has(run.ipo_id) && (run.status === 'success' || run.status === 'partial')) {
      lastSuccessPerIpo.set(run.ipo_id, run)
    }
  }

  // Summary stats — only count explicitly-labelled cron runs, not legacy null-source rows
  const recent30      = runs.slice(0, 30)
  const failedRecent  = recent30.filter(r => r.status === 'failed').length
  const cronRecent    = recent30.filter(r => r.source === 'cron').length
  const lastCronRun   = runs.find(r => r.source === 'cron') ?? null
  const lastRun       = runs[0] ?? null

  const summaryStats = [
    { label: 'Total scrape runs',    value: totalRuns },
    { label: 'Last run',             value: lastRun ? fmt(lastRun.started_at) : 'Never' },
    { label: 'Last cron run',        value: lastCronRun ? fmt(lastCronRun.started_at) : 'Never' },
    { label: 'Cron runs (last 30)',  value: `${cronRecent} / 30` },
    { label: 'Failed (last 30)',     value: failedRecent },
    { label: 'IPOs tracked',         value: ipos.length },
  ]

  return (
    <div className="p-8 space-y-8">
      <RealtimeHealthSync />
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">System Health</h1>
            <PageInfo>Live scraper status across all 7 IPOs. Events are auto-scraped twice daily, diffed against the database, and updated in real time. Use Force Run to manually trigger a scrape, or Preview to see what would change before committing.</PageInfo>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <p className="text-sm text-muted-foreground">
              Live scraper status across all 7 IPOs — events are auto-scraped twice daily, diffed against the database, and updated in real time.
            </p>
            <CronScheduleInfo />
          </div>
        </div>
        <RunAllButton />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {summaryStats.map(({ label, value }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-IPO health table */}
      <div>
        <h2 className="text-base font-semibold mb-4">Per-IPO status</h2>
        <div className="rounded-md border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">IPO</th>
                <th className="px-4 py-3 text-left font-medium">Last run</th>
                <th className="px-4 py-3 text-left font-medium">Last manual</th>
                <th className="px-4 py-3 text-left font-medium">Last successful</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Events found</th>
                <th className="px-4 py-3 text-right font-medium">Duration</th>
                <th className="px-4 py-3 text-right font-medium w-28" />
              </tr>
            </thead>
            <tbody>
              {(ipos).map(ipo => {
                const latest = latestPerIpo.get(ipo.id)
                return (
                  <tr key={ipo.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: ipo.color_hex ?? '#94a3b8' }}
                        />
                        <span className="font-medium">{ipo.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {latest ? fmt(latest.started_at) : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {lastManualPerIpo.has(ipo.id) ? (
                        <span>
                          <span className={`inline-flex items-center rounded px-1 py-0.5 text-xs font-medium mr-1 ${
                            (lastManualPerIpo.get(ipo.id)!.status === 'queued' || lastManualPerIpo.get(ipo.id)!.status === 'running')
                              ? 'bg-yellow-50 text-yellow-700'
                              : lastManualPerIpo.get(ipo.id)!.status === 'failed'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-green-50 text-green-700'
                          }`}>
                            {STATUS_LABEL[lastManualPerIpo.get(ipo.id)!.status] ?? lastManualPerIpo.get(ipo.id)!.status}
                          </span>
                          <span className="text-muted-foreground">{fmt(lastManualPerIpo.get(ipo.id)!.started_at)}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {lastSuccessPerIpo.get(ipo.id) ? fmt(lastSuccessPerIpo.get(ipo.id)!.started_at) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {latest ? (
                        <Badge
                          variant={STATUS_VARIANT[latest.status] ?? 'outline'}
                          className="text-xs capitalize"
                        >
                          {STATUS_LABEL[latest.status] ?? latest.status}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs">
                      {latest?.status === 'skipped' ? '—' : (latest?.events_found ?? '—')}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">
                      {latest ? duration(latest.started_at, latest.finished_at) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <TriggerButton ipoId={ipo.id} ipoName={ipo.name} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent runs log */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">
            Recent runs
            {totalRuns > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({totalRuns} total)
              </span>
            )}
          </h2>
          <ClearRunsButton />
        </div>
        <div className="rounded-md border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">IPO</th>
                <th className="px-4 py-3 text-left font-medium">Started</th>
                <th className="px-4 py-3 text-left font-medium">Source</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Events</th>
                <th className="px-4 py-3 text-right font-medium">Duration</th>
              </tr>
            </thead>
            <tbody>
              {pageRuns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No scrape runs yet
                  </td>
                </tr>
              ) : (
                pageRuns.map(run => {
                  const ipo = (ipos).find(i => i.id === run.ipo_id)
                  return (
                    <tr key={run.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{ipo?.name ?? run.ipo_id}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {fmt(run.started_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                          run.source === 'cron'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                            : run.source === 'manual'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-muted text-muted-foreground'
                        }`}>
                          {run.source ?? 'auto'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={STATUS_VARIANT[run.status] ?? 'outline'}
                          className="text-xs capitalize"
                        >
                          {STATUS_LABEL[run.status] ?? run.status}
                        </Badge>
                        {run.error_message && (
                          <p className="text-xs text-destructive mt-0.5 max-w-xs line-clamp-2">
                            {run.error_message}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs">
                        {run.events_found ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">
                        {duration(run.started_at, run.finished_at)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination for recent runs */}
      {totalRuns > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground text-xs">
            Page {page} of {Math.ceil(totalRuns / PAGE_SIZE)}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link
                href={`?page=${page - 1}`}
                className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted transition-colors"
              >
                ← Previous
              </Link>
            )}
            {page < Math.ceil(totalRuns / PAGE_SIZE) && (
              <Link
                href={`?page=${page + 1}`}
                className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted transition-colors"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Deploy fingerprint — confirms which version is live */}
      <p className="text-xs text-muted-foreground/50 text-right">
        deploy: {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local'}
      </p>
    </div>
  )
}
