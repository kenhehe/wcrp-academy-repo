import { cn } from '@/lib/utils'
import type { MiniColumnsProps } from './types'

const HEIGHT = 40

// Small columns for a short forward-looking series; empty periods show as a baseline tick
export default function MiniColumns({ values, label, className }: MiniColumnsProps) {
  const max = Math.max(...values, 1)
  return (
    <div role="img" aria-label={label} className={cn('flex h-10 items-end gap-[3px]', className)}>
      {values.map((value, i) => (
        <span
          key={i}
          className={cn(
            'w-1.5',
            value === 0 ? 'h-0.5 bg-border' : cn('rounded-t-[2px]', i === 0 ? 'bg-primary' : 'bg-primary/50'),
          )}
          style={value === 0 ? undefined : { height: `${Math.max(4, Math.round((value / max) * HEIGHT))}px` }}
        />
      ))}
    </div>
  )
}
