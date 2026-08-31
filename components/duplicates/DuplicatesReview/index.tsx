import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { buttonVariants } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, LinkIcon, ThumbsDown, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { linkDuplicate, unlinkDuplicate, dismissDuplicate } from '@/lib/actions/event-duplicates'
import ManualDuplicateMatchDialog from '../ManualDuplicateMatchDialog'
import type { DuplicatePair, ConfirmedDuplicateRow } from './types'

const PAGE_SIZE = 10

interface Props {
  ipoFilter?: string
  page:       number
  ipos:       { id: string; name: string }[]
  sp:         Record<string, string | string[] | undefined>
}

function EventSide({ ipoName, title, startDate, url }: { ipoName: string; title: string; startDate: string; url: string | null }) {
  return (
    <div>
      <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {ipoName}
      </span>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block font-medium hover:underline hover:text-primary transition-colors mt-1"
        >
          {title}
        </a>
      ) : (
        <p className="font-medium mt-1">{title}</p>
      )}
      <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{startDate}</p>
    </div>
  )
}

export default async function DuplicatesReview({ ipoFilter, page, ipos, sp }: Props) {
  // Admin client — duplicate review always needs cross-IPO visibility regardless
  // of which account tree rendered this page, and both callers already gate
  // access before reaching here (academy_admin / can_approve), so bypassing RLS
  // here is safe and matches ipo/approvals' precedent.
  const supabase = createAdminClient()
  const ipoIds = ipos.map(i => i.id)
  const ipoNameMap = new Map(ipos.map(i => [i.id, i.name]))

  const [{ data: pairsRaw }, { data: confirmedRaw }] = await Promise.all([
    supabase.rpc('find_cross_ipo_duplicate_pairs', {
      threshold:     0.35,
      p_ipo_id:      ipoFilter ?? null,
      result_limit:  PAGE_SIZE,
      result_offset: (page - 1) * PAGE_SIZE,
    }),
    supabase
      .from('events')
      .select('id,ipo_id,title,start_date,url,duplicate_of_event_id')
      .not('duplicate_of_event_id', 'is', null)
      .in('ipo_id', ipoIds)
      .order('updated_at', { ascending: false })
      .limit(50),
  ])

  const pairs = (pairsRaw ?? []) as DuplicatePair[]
  const totalCount = pairs[0]?.total_count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // Resolve canonical row titles/ipo for the confirmed-duplicates list
  const canonicalIds = [...new Set((confirmedRaw ?? []).map(r => r.duplicate_of_event_id))]
  const { data: canonicalRows } = canonicalIds.length > 0
    ? await supabase.from('events').select('id,ipo_id,title').in('id', canonicalIds)
    : { data: [] }
  const canonicalMap = new Map((canonicalRows ?? []).map(r => [r.id, r]))

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end">
        <ManualDuplicateMatchDialog />
      </div>

      {/* Suggested duplicate pairs */}
      <div className="space-y-4">
        {pairs.length === 0 ? (
          <div className="rounded-md border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
            No suggested duplicates{ipoFilter && ' for the selected IPO'}
          </div>
        ) : (
          pairs.map(pair => {
            const scoreColor = pair.score >= 0.6 ? 'text-green-600 bg-green-50 border-green-200' : 'text-amber-600 bg-amber-50 border-amber-200'
            return (
              <div key={`${pair.event_id}-${pair.duplicate_event_id}`} className="rounded-lg border bg-background p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${scoreColor}`}>
                    {Math.round(pair.score * 100)}% match
                  </span>
                </div>

                <EventSide
                  ipoName={ipoNameMap.get(pair.event_ipo_id) ?? pair.event_ipo_id}
                  title={pair.event_title}
                  startDate={pair.event_start_date}
                  url={pair.event_url}
                />

                <div className="border-t" />

                <EventSide
                  ipoName={ipoNameMap.get(pair.duplicate_ipo_id) ?? pair.duplicate_ipo_id}
                  title={pair.duplicate_title}
                  startDate={pair.duplicate_start_date}
                  url={pair.duplicate_url}
                />

                <div className="flex flex-row gap-2 pt-1">
                  <form action={linkDuplicate}>
                    <input type="hidden" name="event_id" value={pair.event_id} />
                    <input type="hidden" name="duplicate_of_event_id" value={pair.duplicate_event_id} />
                    <button
                      type="submit"
                      className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-green-300 bg-green-50/50 px-3 py-1.5 text-xs font-medium text-green-700 shadow-sm transition-colors hover:border-green-500 hover:bg-green-100 active:bg-green-200"
                    >
                      <LinkIcon className="h-3 w-3" />
                      Same event
                    </button>
                  </form>
                  <form action={dismissDuplicate}>
                    <input type="hidden" name="event_id" value={pair.event_id} />
                    <input type="hidden" name="duplicate_event_id" value={pair.duplicate_event_id} />
                    <button
                      type="submit"
                      className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-sm transition-colors hover:border-destructive hover:bg-destructive/5 hover:text-destructive active:bg-destructive/10"
                    >
                      <ThumbsDown className="h-3 w-3" />
                      Not same event
                    </button>
                  </form>
                </div>
              </div>
            )
          })
        )}

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
