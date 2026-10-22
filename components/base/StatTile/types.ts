import type { ReactNode } from 'react'

export interface StatTileProps {
  label:      string
  value:      ReactNode
  sub?:       ReactNode
  className?: string
}
