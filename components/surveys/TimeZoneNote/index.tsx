'use client'

// "Times are in your local time (Manila, UTC+8)…" under any survey time inputs
import { useSyncExternalStore } from 'react'
import { Globe } from 'lucide-react'
import { describeTimeZone } from '@/lib/data/survey-setup'
import type { TimeZoneNoteProps } from './types'

const subscribe = () => () => {}
const zoneLabel = () => describeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone, -new Date().getTimezoneOffset())

export default function TimeZoneNote({ className }: TimeZoneNoteProps) {
  const zone = useSyncExternalStore(subscribe, zoneLabel, () => null)
  return (
    <p className={className ?? 'flex items-start gap-1.5 text-xs text-muted-foreground'}>
      <Globe className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>
        Times are in your local time{zone ? ` (${zone})` : ''}. Participants see their own local time.
      </span>
    </p>
  )
}
