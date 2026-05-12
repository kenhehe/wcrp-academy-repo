import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, CheckIcon, LinkIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { markInAcademy, confirmMatch } from '../actions'

const PAGE_SIZE = 25

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  Upcoming:  'default',
  Ongoing:   'secondary',
  Past:      'outline',
  Cancelled: 'destructive',
  Postponed: 'outline',
}

type FuzzyMatch = {
  event_id: string
  academy_event_id: string
  academy_title: string
  score: number
  permalink: string | null
}

interface Props {
  ipoFilter?:    string
  statusFilter?: string
  page:          number
  ipos:          { id: string; name: string }[]
  sp:            Record<string, string | string[] | undefined>
}

export default async function GapsTable({ ipoFilter, statusFilter, page, ipos, sp }: Props) {
  const supabase = await createClient()

  let gapsQuery = supabase
    .from('events')
    .select('id,title,start_date,status,url,ipo_id', { count: 'exact' })
    .eq('in_academy', false)
    .order('start_date', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (ipoFilter)    gapsQuery = gapsQuery.eq('ipo_id', ipoFilter)
  if (statusFilter) gapsQuery = gapsQuery.eq('status', statusFilter)

  const { data: gaps, count } = await gapsQuery

  const gapIds = (gaps ?? []).map(g => g.id)
  const { data: fuzzyRaw } = gapIds.length > 0
    ? await supabase.rpc('find_fuzzy_matches', { event_ids: gapIds, threshold: 0.15 })
    : { data: [] }

  const matchMap = new Map<string, FuzzyMatch>(
    (fuzzyRaw ?? []).map((m: FuzzyMatch) => [m.event_id, m])
  )

  const ipoNameMap = new Map(ipos.map(i => [i.id, i.name]))
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  return (
    <>
      <div className="rounded-md border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Event</th>
              <th className="px-4 py-3 text-left font-medium">IPO</th>
              <th className="px-4 py-3 text-left font-medium">Start</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {(gaps ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No gaps found
                  {(ipoFilter || statusFilter) && ' for the selected filters'}
                </td>
              </tr>
            ) : (
              (gaps ?? []).map(row => {
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
                            {'\u2248'}{' '}
                            {match.permalink ? (
                              <a href={match.permalink} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                {match.academy_title}
                              </a>
                            ) : (
                              match.academy_title
                            )}
                            <span className="ml-1 font-medium">({Math.round(match.score * 100)}%)</span>
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
                      <div className="flex flex-col gap-2">
                        <form action={markInAcademy}>
                          <input type="hidden" name="id" value={row.id} />
                          <button
                            type="submit"
                            className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary active:bg-primary/10"
                          >
                            <CheckIcon className="h-3 w-3" />
                            Already in Academy
                          </button>
                        </form>
                        {match && (
                          <form action={confirmMatch}>
                            <input type="hidden" name="event_id"         value={row.id} />
                            <input type="hidden" name="academy_event_id" value={match.academy_event_id} />
                            <button
                              type="submit"
                              className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50/50 px-2.5 py-1 text-xs font-medium text-amber-700 shadow-sm transition-colors hover:border-amber-500 hover:bg-amber-100 active:bg-amber-200"
                            >
                              <LinkIcon className="h-3 w-3" />
                              Yes, same event
                            </button>
                          </form>
                        )}
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
    </>
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
