'use client'

import { Info } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface Props {
  children: React.ReactNode
}

export default function PageInfo({ children }: Props) {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Info className="h-3.5 w-3.5" />
        <span className="sr-only">Page info</span>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm leading-relaxed" align="start" side="bottom">
        {children}
      </PopoverContent>
    </Popover>
  )
}
