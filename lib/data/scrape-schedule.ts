export interface ScheduleEntry {
  ipoId:  string
  name:   string
  method: string
  times:  [number, number]  // minutes after midnight, UTC
}

// Mirrors the per-scraper pg_cron jobs, which live in Postgres and can't be read
// from the app. Change both together (see supabase/functions/CLAUDE.md).
export const SCRAPE_SCHEDULE: ScheduleEntry[] = [
  { ipoId: 'gewex',  name: 'GEWEX',  method: 'HTML scraper',          times: [0,   720] },
  { ipoId: 'cordex', name: 'CORDEX', method: 'HTML scraper',          times: [15,  735] },
  { ipoId: 'esmo',   name: 'ESMO',   method: 'HTML scraper',          times: [30,  750] },
  { ipoId: 'rifs',   name: 'RIfS',   method: 'HTML scraper',          times: [45,  765] },
  { ipoId: 'cmip',   name: 'CMIP',   method: 'Blocked by Cloudflare', times: [60,  780] },
  { ipoId: 'clivar', name: 'CLIVAR', method: 'HTML scraper',          times: [75,  795] },
  { ipoId: 'clic',   name: 'CliC',   method: 'Elfsight API',          times: [105, 825] },
]

const DAY_MS = 86_400_000

export function formatUtcMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function nextScheduledRun(now: number): { entry: ScheduleEntry; at: number } {
  const midnight = Math.floor(now / DAY_MS) * DAY_MS
  const slots = SCRAPE_SCHEDULE.flatMap(entry => entry.times.map(minutes => ({ entry, at: midnight + minutes * 60_000 })))
  const upcoming = [...slots, ...slots.map(slot => ({ ...slot, at: slot.at + DAY_MS }))]
    .filter(slot => slot.at > now)
    .sort((a, b) => a.at - b.at)
  return upcoming[0]
}
