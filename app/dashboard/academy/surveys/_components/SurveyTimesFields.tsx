'use client'

// The event's dates (read-only, from the Academy catalogue: WordPress is where they change),
// the four survey windows (suggested from those dates until the admin types their own) and a
// before / event / after timeline. A stand-alone survey (`noEvent`) has no dates to suggest
// from. Local time throughout, so it renders only in the browser.
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import TimeZoneNote from '@/components/surveys/TimeZoneNote'
import { useIsClient } from '@/lib/hooks/use-is-client'
import {
  formatCatalogueDays, fromLocalInput, resolveSurveyTimes, windowsVsEvent, type LocalTimes, type WindowKey,
} from '@/lib/data/survey-setup'

const WINDOW_LABELS: Record<WindowKey, string> = {
  preOpensAt:   'Before-survey opens',
  preClosesAt:  'Before-survey closes',
  postOpensAt:  'After-survey opens',
  postClosesAt: 'After-survey closes',
}

const show = (value: string) => {
  const d = fromLocalInput(value)
  return d
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
    : '?'
}

interface Props {
  value:     LocalTimes   // eventStart / eventEnd from eventFromCatalogue()
  onChange:  (value: LocalTimes) => void
  disabled?: boolean
  noEvent?:  boolean      // a stand-alone survey, not about any event
}

export default function SurveyTimesFields({ value, onChange, disabled, noEvent }: Props) {
  const isClient = useIsClient()
  if (!isClient) return <Skeleton className="h-64 w-full rounded-lg" />

  const { windows, edited } = resolveSurveyTimes(value)
  const complete = Object.values(windows).every(Boolean)
  const eventDays = formatCatalogueDays(value.eventStart.slice(0, 10) || null, value.eventEnd.slice(0, 10) || null)
  const mismatch = windowsVsEvent(windows, value.eventStart, value.eventEnd)

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
        <span className="block text-xs font-medium text-muted-foreground">{noEvent ? 'Event' : 'Event, from the Academy catalogue'}</span>
        {noEvent
          ? 'None: a stand-alone survey. Set each window yourself.'
          : eventDays ?? 'No start and end dates in the catalogue (an On demand course, for example). Set each window yourself.'}
      </div>

      {mismatch && (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          {mismatch}
        </p>
      )}

      {complete && (
        <ol aria-label="Survey timeline" className="grid overflow-hidden rounded-lg border text-sm sm:grid-cols-[1fr_0.8fr_1fr]">
          <li className="flex flex-col gap-0.5 px-3 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">Before-survey</span>
            {show(windows.preOpensAt)} to {show(windows.preClosesAt)}
          </li>
          <li className="flex flex-col gap-0.5 border-t bg-muted/50 px-3 py-2.5 sm:border-t-0 sm:border-l">
            <span className="text-xs font-medium text-muted-foreground">Event</span>
            {noEvent ? 'None' : eventDays ?? 'No dates'}
          </li>
          <li className="flex flex-col gap-0.5 border-t px-3 py-2.5 sm:border-t-0 sm:border-l">
            <span className="text-xs font-medium text-muted-foreground">After-survey</span>
            {show(windows.postOpensAt)} to {show(windows.postClosesAt)}
          </li>
        </ol>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(WINDOW_LABELS) as WindowKey[]).map(k => (
          <div key={k} className="space-y-2">
            <Label htmlFor={`t-${k}`}>{WINDOW_LABELS[k]}</Label>
            <Input id={`t-${k}`} type="datetime-local" value={windows[k]} disabled={disabled}
              onChange={e => onChange({ ...value, windows: { ...value.windows, [k]: e.target.value } })} />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          {eventDays && (
            <p className="text-xs text-muted-foreground">
              Suggested from the catalogue dates: the before-survey opens a week ahead and closes at 09:00 on the
              first day; the after-survey opens at 17:00 on the last day and stays open two weeks. Change any
              time to match the sessions.
            </p>
          )}
          <TimeZoneNote />
        </div>
        {edited && eventDays && !disabled && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...value, windows: {} })}>
            Use suggested times
          </Button>
        )}
      </div>
    </div>
  )
}
