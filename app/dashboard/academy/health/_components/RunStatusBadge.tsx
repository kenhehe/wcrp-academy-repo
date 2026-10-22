import { ArrowUp, Check, Clock, Loader2, Minus, X, type LucideIcon } from 'lucide-react'
import StatusBadge from '@/components/base/StatusBadge'
import type { StatusTone } from '@/components/base/StatusBadge/types'
import type { RunOutcome } from '@/lib/data/health'

const OUTCOME: Record<RunOutcome, { tone: StatusTone; icon: LucideIcon; label: string }> = {
  found:   { tone: 'primary', icon: ArrowUp, label: 'Found events' },
  same:    { tone: 'info',    icon: Check,   label: 'No change' },
  stuck:   { tone: 'warning', icon: Clock,   label: "Didn't finish" },
  failed:  { tone: 'danger',  icon: X,       label: 'Failed' },
  queued:  { tone: 'info',    icon: Loader2, label: 'Queued' },
  running: { tone: 'info',    icon: Loader2, label: 'Running' },
}

export default function RunStatusBadge({ outcome }: { outcome: RunOutcome | null }) {
  if (!outcome) return <StatusBadge tone="neutral" icon={Minus}>No runs</StatusBadge>

  const { tone, icon, label } = OUTCOME[outcome]
  const inProgress = outcome === 'queued' || outcome === 'running'
  return (
    <StatusBadge tone={tone} icon={icon} className={inProgress ? 'motion-safe:[&>svg]:animate-spin' : undefined}>
      {label}
    </StatusBadge>
  )
}
