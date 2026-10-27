import type { ActivityData } from '@/lib/data/climate-analytics.types'

export interface EventActivityProps {
  data:    ActivityData   // with data.inAcademy, each column shows its Academy share as a darker lower part
  summary: string
}
