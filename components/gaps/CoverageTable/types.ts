import type { CoverageRow } from '@/lib/data/coverage.types'

export interface CoverageTableProps {
  rows:            CoverageRow[]   // getCoverageRows(); used on Gap Analysis and the Academy overview
  // getLighthouseCoverageRows(); the Academy overview shows them as their own group, with
  // subtotals per group and no Review link (Gap Analysis covers the IPOs only)
  lighthouseRows?: CoverageRow[]
}
