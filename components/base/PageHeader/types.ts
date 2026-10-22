import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title:        ReactNode
  info?:        ReactNode   // content of the PageInfo popover next to the title
  description?: ReactNode
  actions?:     ReactNode
  className?:   string
}
