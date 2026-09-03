import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import PublicationFlags from '@/components/events/PublicationFlags'
import { PAGE_SIZE } from './types'
import type { RegistryOrg } from './types'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  Upcoming:  'default',
  Ongoing:   'secondary',
  Past:      'outline',
  Cancelled: 'destructive',
  Postponed: 'outline',
}

const APPROVAL_BADGE: Record<string, { label: string; className: string }> = {
  pending:  { label: 'Pending',  className: 'text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30' },
  approved: { label: 'Approved', className: 'text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' },
}

interface Props {
  queryText?:    string
  ipoFilter?:    string
  statusFilter?: string
  yearFilter?:   string
  page:          number
  orgs:          RegistryOrg[]
  sp:            Record<string, string | string[] | undefined>
}

export default async function EventRegistryBrowser({ queryText, ipoFilter, statusFilter, yearFilter, page, orgs, sp }: Props) {
  // Admin client — spans every org, a plain session's RLS won't show that
  const db = createAdminClient()

  let query = db
    .from('events')
    .select('id,ipo_id,title,start_date,end_date,status,location,country,url,approval_status,wants_social_media,wants_website_article,wants_newsletter', { count: 'exact' })
    .order('start_date', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (queryText)    query = query.ilike('title', `%${queryText}%`)
  if (ipoFilter)    query = query.eq('ipo_id', ipoFilter)
  if (statusFilter) query = query.eq('status', statusFilter)
  if (yearFilter) {
    const y = parseInt(yearFilter)
    query = query.gte('start_date', `${y}-01-01`).lte('start_date', `${y}-12-31`)
  }

  const { data: events, count } = await query
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  const orgMap = new Map(orgs.map(o => [o.id, o]))

  return (
    <>
      <div className="rounded-md border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Event</th>
              <th className="px-4 py-3 text-left font-medium">Org</th>
              <th className="px-4 py-3 text-left font-medium">Dates</th>
              <th className="px-4 py-3 text-left font-medium">Location</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Approval</th>
              <th className="px-4 py-3 text-left font-medium">Wants</th>
            </tr>
          </thead>
          <tbody>
            {(events ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No events found{(queryText || ipoFilter || statusFilter || yearFilter) && ' for the selected filters'}
                </td>
              </tr>
            ) : (
              (events ?? []).map(event => {
                const org      = orgMap.get(event.ipo_id)
                const approval = event.approval_status ? APPROVAL_BADGE[event.approval_status] : undefined
                return (
                  <tr key={event.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 max-w-xs">
                      {event.url ? (
                        <a
                          href={event.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium truncate block hover:underline hover:text-primary transition-colors"
                        >
                          {event.title}
                        </a>
                      ) : (
                        <p className="font-medium truncate">{event.title}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: org?.color_hex ?? '#6b7280' }} />
                        <span className="text-sm text-muted-foreground">{org?.name ?? event.ipo_id}</span>
                        {org?.type === 'lighthouse' && (
                          <Sparkles className="h-3 w-3 text-amber-500 flex-shrink-0" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                      {event.start_date}
                      {event.end_date && event.end_date !== event.start_date && (
                        <span> → {event.end_date}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {[event.location, event.country].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[event.status] ?? 'outline'} className="text-xs">
                        {event.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {approval ? (
                        <Badge variant="outline" className={`text-xs ${approval.className}`}>
                          {approval.label}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <PublicationFlags
                        wants_social_media={event.wants_social_media}
                        wants_website_article={event.wants_website_article}
                        wants_newsletter={event.wants_newsletter}
                      />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground mt-4">
          <span>{count ?? 0} events · page {page} of {totalPages}</span>
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
