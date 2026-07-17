'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { approveEvent } from '../actions'

interface PendingEvent {
  id:         string
  title:      string
  start_date: string
  end_date:   string | null
  location:   string | null
  country:    string | null
  ipo_id:     string
  ipoName:    string
  ipoColor:   string
}

interface Props {
  events: PendingEvent[]
}

function ApproveButton({ eventId }: { eventId: string }) {
  const [isPending, startTransition] = useTransition()

  function handleApprove() {
    startTransition(async () => {
      try {
        await approveEvent(eventId)
        toast.success('Event approved — it is now visible on the calendar')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to approve')
      }
    })
  }

  return (
    <button
      onClick={handleApprove}
      disabled={isPending}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50/50 px-2.5 py-1 text-xs font-medium text-emerald-700 shadow-sm transition-colors hover:border-emerald-500 hover:bg-emerald-100 active:bg-emerald-200 disabled:opacity-50 dark:bg-emerald-950/30 dark:text-emerald-400"
    >
      {isPending
        ? <Loader2 className="h-3 w-3 animate-spin" />
        : <CheckCircle2 className="h-3 w-3" />
      }
      {isPending ? 'Approving…' : 'Approve'}
    </button>
  )
}

export default function ApprovalsTable({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="rounded-md border bg-background px-6 py-16 text-center text-sm text-muted-foreground">
        No events pending approval — all lighthouse submissions are up to date.
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-background overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Event</th>
            <th className="px-4 py-3 text-left font-medium">Lighthouse Activity</th>
            <th className="px-4 py-3 text-left font-medium">Dates</th>
            <th className="px-4 py-3 text-left font-medium">Location</th>
            <th className="px-4 py-3 text-left font-medium" />
          </tr>
        </thead>
        <tbody>
          {events.map(event => (
            <tr key={event.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 max-w-xs">
                <p className="font-medium truncate">{event.title}</p>
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
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                    Pending
                  </Badge>
                  <ApproveButton eventId={event.id} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
