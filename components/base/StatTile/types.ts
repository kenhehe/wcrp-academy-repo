import type { ReactNode } from 'react'

export interface StatTileChange {
  direction:   'up' | 'down' | 'flat'
  label:       string      // "+12%", "−13%", "2 fewer"
  comparison?: ReactNode   // "vs same date in 2025 (120)"
}

export interface StatTileProps {
  label:      string
  value:      ReactNode
  sub?:       ReactNode
  change?:    StatTileChange   // up = green, down = red, always with an arrow icon
  aside?:     ReactNode        // right of the value: a sparkline, mini columns or an action
  className?: string
}
