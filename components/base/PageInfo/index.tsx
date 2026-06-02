'use client'

import { Info } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface Props {
  children: React.ReactNode
}

export default function PageInfo({ children }: Props) {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center justify-center rounded-full text-muted-foreground/50 hover:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Info className="h-4 w-4" />
        <span className="sr-only">Page info</span>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm leading-relaxed" align="start" side="bottom">
        {children}
      </PopoverContent>
    </Popover>
  )
}
