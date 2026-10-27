import CoverageTable from '@/components/gaps/CoverageTable'
import { getCoverageRows } from '@/lib/data/coverage'

// The Gap Analysis coverage table, one row per IPO
export default async function OverviewCoverage() {
  return <CoverageTable rows={await getCoverageRows()} />
}
