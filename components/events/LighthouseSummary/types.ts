import type { LighthouseSummary } from '@/lib/data/climate-analytics.types'

export interface LighthouseSummaryProps {
  programmes:    LighthouseSummary[]   // summariseLighthouse(); with their inAcademy counts, each row adds one
  footer:        { href: string; label: string }
  registryHref?: string                // that dashboard's Event Registry: each programme then links to its own events there
}
