import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import PublicationFlags from '@/components/events/PublicationFlags'

interface FlaggedEvent {
  id:                     string
  title:                  string
  start_date:             string
  end_date:               string | null
  location:               string | null
  country:                string | null
  url:                    string | null
  ipo_id:                 string
  approval_status:        string | null
  wants_social_media:     boolean
  wants_website_article:  boolean
  wants_newsletter:       boolean
  ipoName:                string
  ipoColor:               string
}

interface Props {
  events:     FlaggedEvent[]
  page:       number
  totalPages: number
  sp:         Record<string, string | string[] | undefined>
}

const APPROVAL_BADGE: Record<string, { label: string; className: string }> = {
  pending:  { label: 'Pending',  className: 'text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30' },
  approved: { label: 'Approved', className: 'text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' },
}

export default function PublicationRequestsTable({ events, page, totalPages, sp }: Props) {
  if (events.length === 0) {
    return (
      <div className="rounded-md border bg-background px-6 py-16 text-center text-sm text-muted-foreground">
        No events flagged for publication yet.
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Event</th>
              <th className="px-4 py-3 text-left font-medium">IPO</th>
              <th className="px-4 py-3 text-left font-medium">Dates</th>
              <th className="px-4 py-3 text-left font-medium">Location</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Wants</th>
            </tr>
          </thead>
          <tbody>
            {events.map(event => {
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
                      <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: event.ipoColor }} />
                      <span className="text-sm text-muted-foreground">{event.ipoName}</span>
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
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground mt-4">
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
