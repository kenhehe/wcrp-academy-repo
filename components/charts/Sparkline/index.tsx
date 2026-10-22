import { cn } from '@/lib/utils'
import type { SparklineProps } from './types'

const W = 112
const H = 40
const PAD = 5

// History in a lighter tint of the primary colour, the latest step and end dot in full primary
export default function Sparkline({ values, label, className }: SparklineProps) {
  if (values.length < 2) throw new Error(`Sparkline needs at least 2 values, got ${values.length}`)

  const hi = Math.max(...values)
  const lo = Math.min(...values)
  const points = values.map((v, i) => [
    PAD + (i * (W - 2 * PAD)) / (values.length - 1),
    PAD + (H - 2 * PAD) * (1 - (v - lo) / (hi - lo || 1)),
  ])
  const toAttr = (pts: number[][]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [endX, endY] = points[points.length - 1]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label={label}
      className={cn('overflow-visible', className)}
    >
      <polyline
        points={toAttr(points)}
        fill="none"
        stroke="color-mix(in oklab, var(--primary) 45%, transparent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline points={toAttr(points.slice(-2))} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinecap="round" />
      <circle cx={endX} cy={endY} r={4} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
    </svg>
  )
}
