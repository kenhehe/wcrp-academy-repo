import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'primary'

export interface StatusBadgeProps {
  tone:       StatusTone
  icon?:      LucideIcon
  children:   ReactNode
  className?: string
}
