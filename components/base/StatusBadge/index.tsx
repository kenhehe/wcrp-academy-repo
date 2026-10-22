import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { StatusBadgeProps, StatusTone } from './types'

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info:    'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger:  'bg-danger-soft text-danger',
  primary: 'bg-primary text-primary-foreground',
}

export default function StatusBadge({ tone, icon: Icon, children, className }: StatusBadgeProps) {
  return (
    <Badge className={cn(TONE_CLASS[tone], className)}>
      {Icon && <Icon data-icon="inline-start" aria-hidden="true" />}
      {children}
    </Badge>
  )
}
