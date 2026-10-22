import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { StatTileProps } from './types'

export default function StatTile({ label, value, sub, className }: StatTileProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-2xl font-semibold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}
