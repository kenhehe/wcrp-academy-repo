import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title:        ReactNode
  eyebrow?:     ReactNode   // small line above the title, e.g. today's date
  info?:        ReactNode   // content of the PageInfo popover next to the title
  description?: ReactNode
  actions?:     ReactNode
  className?:   string
}
