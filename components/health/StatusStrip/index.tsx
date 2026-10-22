import { cn } from '@/lib/utils'
import { DAY_STATUS_LABEL, type DayStatus } from '@/lib/data/health'
import type { StatusStripProps } from './types'

const DAY_CLASS: Record<DayStatus, string> = {
  found:  'bg-run-found',
  same:   'bg-run-same',
  stuck:  'bg-run-stuck',
  failed: 'bg-run-failed',
  none:   'bg-run-none',
}

const LEGEND_ORDER: DayStatus[] = ['found', 'same', 'stuck', 'failed', 'none']

export default function StatusStrip({ days, label, className }: StatusStripProps) {
  return (
    <div role="img" aria-label={label} className={cn('flex h-7 min-w-0 gap-0.5', className)}>
      {days.map(day => (
        <span
          key={day.date}
          title={day.title}
          className={cn(
            'min-w-0.5 flex-1 origin-bottom rounded-[2px] hover:brightness-110 motion-safe:animate-strip-grow',
            DAY_CLASS[day.status],
          )}
        />
      ))}
    </div>
  )
}

export function StatusStripLegend() {
  return (
    <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {LEGEND_ORDER.map(status => (
        <li key={status} className="inline-flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-[2px]', DAY_CLASS[status])} />
          {DAY_STATUS_LABEL[status]}
        </li>
      ))}
    </ul>
  )
}
