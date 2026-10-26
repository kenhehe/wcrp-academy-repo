'use client'

// Event dates, the four survey windows (suggested from the event dates until the admin types
// their own) and a before / event / after timeline. Local time throughout, so it renders only
// in the browser.
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import TimeZoneNote from '@/components/surveys/TimeZoneNote'
import { useIsClient } from '@/lib/hooks/use-is-client'
import { fromLocalInput, resolveSurveyTimes, type LocalTimes, type WindowKey } from '@/lib/data/survey-setup'

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
  value:     LocalTimes
  onChange:  (value: LocalTimes) => void
  note?:     ReactNode   // shown above the event dates (where they came from)
  disabled?: boolean
}

export default function SurveyTimesFields({ value, onChange, note, disabled }: Props) {
  const isClient = useIsClient()
  if (!isClient) return <Skeleton className="h-64 w-full rounded-lg" />

  const { windows, edited } = resolveSurveyTimes(value)
  const complete = Object.values(windows).every(Boolean)

  return (
    <div className="space-y-4">
      {note}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="t-ev-start">Event starts</Label>
          <Input id="t-ev-start" type="datetime-local" value={value.eventStart} disabled={disabled}
            onChange={e => onChange({ ...value, eventStart: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="t-ev-end">Event ends</Label>
          <Input id="t-ev-end" type="datetime-local" value={value.eventEnd} disabled={disabled}
            onChange={e => onChange({ ...value, eventEnd: e.target.value })} />
        </div>
      </div>

      {complete && (
        <ol aria-label="Survey timeline" className="grid overflow-hidden rounded-lg border text-sm sm:grid-cols-[1fr_0.8fr_1fr]">
          <li className="flex flex-col gap-0.5 px-3 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">Before-survey</span>
            {show(windows.preOpensAt)} to {show(windows.preClosesAt)}
          </li>
          <li className="flex flex-col gap-0.5 border-t bg-muted/50 px-3 py-2.5 sm:border-t-0 sm:border-l">
            <span className="text-xs font-medium text-muted-foreground">Event</span>
            {show(value.eventStart)} to {show(value.eventEnd)}
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
          <p className="text-xs text-muted-foreground">
            Suggested: the before-survey opens a week ahead and closes when the event starts; the after-survey
            opens when it ends and stays open two weeks.
          </p>
          <TimeZoneNote />
        </div>
        {edited && !disabled && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...value, windows: {} })}>
            Use suggested times
          </Button>
        )}
      </div>
    </div>
  )
}
