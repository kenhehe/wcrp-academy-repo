import { cn } from '@/lib/utils'
import type { OrgDotProps } from './types'

// The org's identity colour; the ring keeps dark colours visible on dark surfaces
export default function OrgDot({ color, className }: OrgDotProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-2.5 shrink-0 rounded-full ring-1 ring-foreground/20', className)}
      style={{ background: color ?? 'var(--muted-foreground)' }}
    />
  )
}
