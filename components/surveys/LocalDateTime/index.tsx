'use client'

// A moment shown in the viewer's own time zone. The server doesn't know it, so the first
// render (server and hydration) says UTC, then the browser swaps in local time.
import { useIsClient } from '@/lib/hooks/use-is-client'
import type { LocalDateTimeProps } from './types'

export default function LocalDateTime({ iso, dateOnly = false, withYear = false, fallback = '—' }: LocalDateTimeProps) {
  const isClient = useIsClient()
  if (!iso) return <>{fallback}</>

  const text = new Intl.DateTimeFormat('en-GB', {
    day:   'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    ...(dateOnly ? {} : { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
    ...(isClient ? {} : { timeZone: 'UTC' }),
  }).format(new Date(iso))

  return <time dateTime={iso}>{isClient || dateOnly ? text : `${text} UTC`}</time>
}
