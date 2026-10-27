import type { CoverageRow } from '@/lib/data/coverage.types'

export interface CoverageTableProps {
  rows: CoverageRow[]   // getCoverageRows(); used on Gap Analysis and the Academy overview
}
