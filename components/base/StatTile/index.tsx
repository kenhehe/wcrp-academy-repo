import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import StatusBadge from '@/components/base/StatusBadge'
import type { StatTileProps } from './types'

const CHANGE = {
  up:   { tone: 'success', icon: ArrowUpRight },
  down: { tone: 'danger',  icon: ArrowDownRight },
  flat: { tone: 'neutral', icon: Minus },
} as const

export default function StatTile({ label, value, sub, change, aside, className }: StatTileProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="flex items-end justify-between gap-3">
          <p className="text-2xl font-semibold">{value}</p>
          {aside && <div className="shrink-0">{aside}</div>}
        </div>
        {change && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
            <StatusBadge tone={CHANGE[change.direction].tone} icon={CHANGE[change.direction].icon}>
              {change.label}
            </StatusBadge>
            {change.comparison && <span>{change.comparison}</span>}
          </div>
        )}
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  )
}
