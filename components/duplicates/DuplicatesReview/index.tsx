import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, LinkIcon, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { linkDuplicate, unlinkDuplicate } from '@/lib/actions/event-duplicates'
import ManualDuplicateMatchDialog from '../ManualDuplicateMatchDialog'
import type { DuplicateMatch, ConfirmedDuplicateRow } from './types'

const PAGE_SIZE = 25

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  Upcoming:  'default',
  Ongoing:   'secondary',
  Past:      'outline',
  Cancelled: 'destructive',
  Postponed: 'outline',
}

interface Props {
  ipoFilter?: string
  page:       number
  ipos:       { id: string; name: string }[]
  sp:         Record<string, string | string[] | undefined>
}

export default async function DuplicatesReview({ ipoFilter, page, ipos, sp }: Props) {
  // Admin client — duplicate review always needs cross-IPO visibility regardless
  // of which account tree rendered this page, and both callers already gate
  // access before reaching here (academy_admin / can_approve), so bypassing RLS
  // here is safe and matches ipo/approvals' precedent.
  const supabase = createAdminClient()
  const ipoIds = ipos.map(i => i.id)
  const ipoNameMap = new Map(ipos.map(i => [i.id, i.name]))

  let reviewQuery = supabase
    .from('events')
    .select('id,title,start_date,status,url,ipo_id', { count: 'exact' })
    .is('duplicate_of_event_id', null)
    .in('ipo_id', ipoIds)
    .order('start_date', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (ipoFilter) reviewQuery = reviewQuery.eq('ipo_id', ipoFilter)

  const [{ data: reviewRows, count }, { data: confirmedRaw }] = await Promise.all([
    reviewQuery,
    supabase
      .from('events')
      .select('id,ipo_id,title,start_date,url,duplicate_of_event_id')
      .not('duplicate_of_event_id', 'is', null)
      .in('ipo_id', ipoIds)
      .order('updated_at', { ascending: false })
      .limit(50),
  ])

  const reviewIds = (reviewRows ?? []).map(r => r.id)
  const { data: fuzzyRaw } = reviewIds.length > 0
    ? await supabase.rpc('find_cross_ipo_duplicates', { event_ids: reviewIds, threshold: 0.35 })
    : { data: [] }

  const matchMap = new Map<string, DuplicateMatch>(
    (fuzzyRaw ?? []).map((m: DuplicateMatch) => [m.event_id, m])
  )

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  // Sort: rows with a fuzzy match first (highest score first), unmatched after
  const sortedRows = [...(reviewRows ?? [])].sort((a, b) => {
    const sa = matchMap.get(a.id)?.score ?? -1
    const sb = matchMap.get(b.id)?.score ?? -1
    return sb - sa
  })

  // Resolve canonical row titles/ipo for the confirmed-duplicates list
  const canonicalIds = [...new Set((confirmedRaw ?? []).map(r => r.duplicate_of_event_id))]
  const { data: canonicalRows } = canonicalIds.length > 0
    ? await supabase.from('events').select('id,ipo_id,title').in('id', canonicalIds)
    : { data: [] }
  const canonicalMap = new Map((canonicalRows ?? []).map(r => [r.id, r]))

  return (
    <div className="space-y-8">
      {/* Review queue */}
      <div className="space-y-4">
        <div className="rounded-md border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Event</th>
                <th className="px-4 py-3 text-left font-medium">IPO</th>
                <th className="px-4 py-3 text-left font-medium">Start</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No unreviewed events{ipoFilter && ' for the selected IPO'}
                  </td>
                </tr>
              ) : (
                sortedRows.map(row => {
                  const match = matchMap.get(row.id)
                  return (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 max-w-sm">
                        {row.url ? (
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate font-medium hover:underline hover:text-primary transition-colors block"
                          >
                            {row.title}
                          </a>
                        ) : (
                          <p className="truncate font-medium">{row.title}</p>
                        )}
                        {match && (() => {
                          const scoreColor = match.score >= 0.6 ? 'text-green-600' : match.score >= 0.35 ? 'text-amber-600' : 'text-muted-foreground'
                          return (
                            <p className={`truncate text-xs mt-0.5 ${scoreColor}`}>
                              {'≈'}{' '}
                              {match.duplicate_url ? (
                                <a href={match.duplicate_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                  {match.duplicate_title}
                                </a>
                              ) : (
                                match.duplicate_title
                              )}
                              <span className="ml-1 uppercase tracking-wide">
                                ({ipoNameMap.get(match.duplicate_ipo_id) ?? match.duplicate_ipo_id})
                              </span>
                              <span className="ml-1 font-medium">{Math.round(match.score * 100)}%</span>
                            </p>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {ipoNameMap.get(row.ipo_id) ?? row.ipo_id}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums text-xs text-muted-foreground">
                        {row.start_date}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[row.status] ?? 'outline'} className="text-xs">
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-row gap-2 flex-wrap">
                          {match && (
                            <form action={linkDuplicate}>
                              <input type="hidden" name="event_id" value={row.id} />
                              <input type="hidden" name="duplicate_of_event_id" value={match.duplicate_event_id} />
                              <button
                                type="submit"
                                className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50/50 px-2.5 py-1 text-xs font-medium text-amber-700 shadow-sm transition-colors hover:border-amber-500 hover:bg-amber-100 active:bg-amber-200"
                              >
                                <LinkIcon className="h-3 w-3" />
                                Yes, same event
                              </button>
                            </form>
                          )}
                          <ManualDuplicateMatchDialog eventId={row.id} eventTitle={row.title} ipoId={row.ipo_id} />
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link href={`?${buildPageParams(sp, page - 1)}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              ) : (
                <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'opacity-50 pointer-events-none')}>
                  <ChevronLeft className="h-4 w-4" />
                </span>
              )}
              {page < totalPages ? (
                <Link href={`?${buildPageParams(sp, page + 1)}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'opacity-50 pointer-events-none')}>
                  <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirmed duplicates */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Confirmed duplicates</h2>
        <div className="rounded-md border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Event</th>
                <th className="px-4 py-3 text-left font-medium">IPO</th>
                <th className="px-4 py-3 text-left font-medium">Linked as duplicate of</th>
                <th className="px-4 py-3 text-left font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {(confirmedRaw ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No confirmed duplicates yet
                  </td>
                </tr>
              ) : (
                (confirmedRaw as ConfirmedDuplicateRow[]).map(row => {
                  const canonical = canonicalMap.get(row.duplicate_of_event_id)
                  return (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="px-4 py-3 max-w-sm">
                        {row.url ? (
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate font-medium hover:underline hover:text-primary transition-colors block"
                          >
                            {row.title}
                          </a>
                        ) : (
                          <p className="truncate font-medium">{row.title}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {ipoNameMap.get(row.ipo_id) ?? row.ipo_id}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-sm truncate">
                        {canonical ? `${canonical.title} (${ipoNameMap.get(canonical.ipo_id) ?? canonical.ipo_id})` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <form action={unlinkDuplicate}>
                          <input type="hidden" name="event_id" value={row.id} />
                          <button
                            type="submit"
                            className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground shadow-sm transition-colors hover:border-destructive hover:bg-destructive/5 hover:text-destructive active:bg-destructive/10"
                          >
                            <Undo2 className="h-3 w-3" />
                            Undo
                          </button>
                        </form>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function buildPageParams(
  sp: Record<string, string | string[] | undefined>,
  newPage: number
): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'page') continue
    if (typeof v === 'string') params.set(k, v)
  }
  params.set('page', String(newPage))
  return params.toString()
}
