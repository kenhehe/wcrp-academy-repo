'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import type { EventsStackedBarProps } from './types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// --- Data builders ---

function makeLookup(events: EventsStackedBarProps['events']) {
  const map = new Map<string, number>()
  for (const e of events) {
    if (e.year != null && e.month != null) {
      const key = `${e.org_id}-${e.year}-${e.month}`
      map.set(key, (map.get(key) ?? 0) + 1)
    }
  }
  return map
}

function buildYearData(orgs: EventsStackedBarProps['orgs'], events: EventsStackedBarProps['events']) {
  const lookup = makeLookup(events)
  const years  = [...new Set(events.map(e => e.year).filter((y): y is number => y != null))].sort()
  return years.map(year => {
    const row: Record<string, string | number> = { period: String(year) }
    for (const org of orgs) {
      row[org.id] = 0
      for (let m = 1; m <= 12; m++) {
        row[org.id] = (row[org.id] as number) + (lookup.get(`${org.id}-${year}-${m}`) ?? 0)
      }
    }
    return row
  })
}

function buildMonthData(orgs: EventsStackedBarProps['orgs'], events: EventsStackedBarProps['events']) {
  const lookup = makeLookup(events)
  const years  = [...new Set(events.map(e => e.year).filter((y): y is number => y != null))]
  return MONTHS.map((label, i) => {
    const month = i + 1
    const row: Record<string, string | number> = { period: label }
    for (const org of orgs) {
      let count = 0
      for (const year of years) count += lookup.get(`${org.id}-${year}-${month}`) ?? 0
      row[org.id] = count
    }
    return row
  })
}

function buildTimelineData(orgs: EventsStackedBarProps['orgs'], events: EventsStackedBarProps['events']) {
  const lookup = makeLookup(events)

  // collect every year-month that has at least one event, then fill the range
  const pairs = events
    .filter(e => e.year != null && e.month != null)
    .map(e => ({ y: e.year as number, m: e.month as number }))
  if (!pairs.length) return []

  const minY = Math.min(...pairs.map(p => p.y))
  const minM = Math.min(...pairs.filter(p => p.y === minY).map(p => p.m))
  const maxY = Math.max(...pairs.map(p => p.y))
  const maxM = Math.max(...pairs.filter(p => p.y === maxY).map(p => p.m))

  const periods: { year: number; month: number; period: string }[] = []
  let y = minY, m = minM
  while (y < maxY || (y === maxY && m <= maxM)) {
    periods.push({ year: y, month: m, period: `${y}-${String(m).padStart(2, '0')}` })
    m++; if (m > 12) { m = 1; y++ }
  }

  return periods.map(({ year, month, period }) => {
    const row: Record<string, string | number> = { period }
    for (const org of orgs) {
      row[org.id] = lookup.get(`${org.id}-${year}-${month}`) ?? 0
    }
    return row
  })
}

// --- Custom X-axis tick for timeline mode ---
// Shows month label at quarterly intervals; year label at every January (and the first period).

interface TickProps {
  x?:       string | number
  y?:       string | number
  payload?: { value: string }
  firstPeriod: string
}

function TimelineTick({ x = 0, y = 0, payload, firstPeriod }: TickProps) {
  const nx = typeof x === 'string' ? parseFloat(x) : x
  const ny = typeof y === 'string' ? parseFloat(y) : y
  if (!payload) return null
  const [yearStr, monthStr] = payload.value.split('-')
  const year  = parseInt(yearStr)
  const month = parseInt(monthStr)
  const isFirst   = payload.value === firstPeriod
  const showYear  = month === 1 || isFirst
  // quarterly month labels: Jan Apr Jul Oct
  const showMonth = month === 1 || month === 4 || month === 7 || month === 10

  if (!showYear && !showMonth) return <g />

  return (
    <g transform={`translate(${nx},${ny})`}>
      {showMonth && (
        <text
          dy={13}
          textAnchor="middle"
          fontSize={9}
          fill="hsl(var(--muted-foreground))"
        >
          {MONTHS[month - 1]}
        </text>
      )}
      {showYear && (
        <text
          dy={showMonth ? 24 : 13}
          textAnchor="middle"
          fontSize={10}
          fontWeight={600}
          fill="hsl(var(--foreground))"
        >
          {year}
        </text>
      )}
    </g>
  )
}

// --- Tooltip ---

interface TooltipEntry {
  name:  string
  value: number
  fill:  string
}

function CustomTooltip({ active, payload, label }: {
  active?:  boolean
  payload?: TooltipEntry[]
  label?:   string
}) {
  if (!active || !payload?.length) return null

  // Humanise the period label for timeline mode ("2024-06" → "Jun 2024")
  const display = /^\d{4}-\d{2}$/.test(label ?? '')
    ? (() => {
        const [y, m] = (label ?? '').split('-').map(Number)
        return `${MONTHS[m - 1]} ${y}`
      })()
    : label

  const total   = payload.reduce((s, p) => s + (p.value ?? 0), 0)
  const visible = payload.filter(p => p.value > 0)

  return (
    <div style={{
      background:    'var(--background)',
      border:        '1px solid var(--border)',
      borderRadius:  6,
      padding:       '8px 12px',
      fontSize:      12,
      color:         'var(--foreground)',
      boxShadow:     '0 2px 8px rgb(0 0 0 / 0.08)',
      minWidth:      140,
      pointerEvents: 'none',
    }}>
      <p style={{ fontWeight: 600, marginBottom: 6 }}>{display}</p>
      {visible.map(p => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: p.fill, flexShrink: 0 }} />
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>{p.name}</span>
          </span>
          <span style={{ fontWeight: 500 }}>{p.value}</span>
        </div>
      ))}
      {visible.length > 1 && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>Total</span>
          <span style={{ fontWeight: 600 }}>{total}</span>
        </div>
      )}
    </div>
  )
}

// --- Main component ---

type View = 'timeline' | 'year' | 'month'

const VIEWS: { value: View; label: string }[] = [
  { value: 'timeline', label: 'Timeline' },
  { value: 'year',     label: 'By year'  },
  { value: 'month',    label: 'By month' },
]

export default function EventsStackedBar({ orgs, events, height = 220 }: EventsStackedBarProps) {
  const [view,    setView]    = useState<View>('timeline')
  const [mounted, setMounted] = useState(false)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true) }, [])

  const timelineData = buildTimelineData(orgs, events)
  const yearData     = buildYearData(orgs, events)
  const monthData    = buildMonthData(orgs, events)

  const chartData =
    view === 'timeline' ? timelineData :
    view === 'year'     ? yearData     :
    monthData

  const firstPeriod = String(timelineData[0]?.period ?? '')

  // Extra bottom margin for timeline's two-row tick labels
  const bottomMargin = view === 'timeline' ? 28 : 0

  if (!mounted) {
    return <div style={{ height }} className="flex items-center justify-center text-xs text-muted-foreground">Loading…</div>
  }

  if (!events.length) {
    return <div style={{ height }} className="flex items-center justify-center text-xs text-muted-foreground">No data</div>
  }

  return (
    <div className="space-y-4">

      {/* View toggle */}
      <div className="flex items-center gap-1 w-fit rounded-md border bg-muted/40 p-0.5">
        {VIEWS.map(v => (
          <button
            key={v.value}
            onClick={() => setView(v.value)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              view === v.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: bottomMargin }}>
            <XAxis
              dataKey="period"
              interval={0}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              tick={view === 'timeline'
                ? ((props: TickProps) => (
                    <TimelineTick {...props} firstPeriod={firstPeriod} />
                  )) as unknown as React.ReactElement
                : { fontSize: 11, fill: 'hsl(var(--muted-foreground))' }
              }
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
            />
            {orgs.map(org => (
              <Bar
                key={org.id}
                dataKey={org.id}
                name={org.name}
                stackId="a"
                fill={org.color}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {orgs.map(org => (
          <div key={org.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: org.color }} />
            {org.name}
          </div>
        ))}
      </div>
    </div>
  )
}
