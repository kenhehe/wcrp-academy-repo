import { formatRate } from '@/lib/data/survey-progress'
import type { SurveyProgress } from '@/lib/data/surveys.types'

// Matched ÷ answered before, as a bar with the numbers next to it
export default function MatchRateMeter({ progress, label }: { progress: SurveyProgress; label: string }) {
  if (progress.matchRate === null) return <span className="text-muted-foreground">—</span>
  const pct = Math.round(progress.matchRate * 100)
  return (
    <div className="flex items-center gap-3">
      <div
        role="img"
        aria-label={`${label}: match rate ${pct}%, ${progress.matched} of ${progress.pre} who answered before also answered after`}
        className="h-2 w-28 shrink-0 overflow-hidden rounded-full bg-accent"
      >
        <div className="h-full min-w-[3px] rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 font-semibold tabular-nums">{formatRate(progress.matchRate)}</span>
    </div>
  )
}
