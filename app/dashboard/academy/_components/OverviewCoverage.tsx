import CoverageTable from '@/components/gaps/CoverageTable'
import { getCoverageRows, getLighthouseCoverageRows } from '@/lib/data/coverage'

// The Gap Analysis coverage table, one row per IPO, with the Lighthouse programmes as a group of their own
export default async function OverviewCoverage() {
  const [rows, lighthouseRows] = await Promise.all([getCoverageRows(), getLighthouseCoverageRows()])
  return <CoverageTable rows={rows} lighthouseRows={lighthouseRows} />
}
