import type { StripDay } from '@/lib/data/health'

export interface StatusStripProps {
  days:       StripDay[]
  label:      string  // accessible summary of the whole strip
  className?: string
}
