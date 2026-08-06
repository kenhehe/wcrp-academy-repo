'use client'

import { useState, useEffect, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import type { EventsStackedBarProps } from './types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function buildYearData(orgs: EventsStackedBarProps['orgs'], events: EventsStackedBarProps['events']) {
  const years = [...new Set(events.map(e => e.year).filter((y): y is number => y != null))].sort()
  return years.map(year => {
    const row: Record<string, string | number> = { period: String(year) }
    for (const org of orgs) {
      row[org.id] = events.filter(e => e.org_id === org.id && e.year === year).length
    }
    return row
  })
}

function buildMonthData(orgs: EventsStackedBarProps['orgs'], events: EventsStackedBarProps['events']) {
  return MONTHS.map((label, i) => {
    const month = i + 1
    const row: Record<string, string | number> = { period: label }
    for (const org of orgs) {
      row[org.id] = events.filter(e => e.org_id === org.id && e.month === month).length
    }
    return row
  })
}

interface TooltipPayloadEntry {
  name:  string
  value: number
  fill:  string
}

function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?:  string
}) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0)
  const visible = payload.filter(p => p.value > 0)
  return (
    <div
      style={{
        background:   'var(--background)',
        border:       '1px solid var(--border)',
        borderRadius: 6,
        padding:      '8px 12px',
        fontSize:     12,
        color:        'var(--foreground)',
        boxShadow:    '0 2px 8px rgb(0 0 0 / 0.08)',
        minWidth:     140,
        pointerEvents: 'none',
      }}
    >
      <p style={{ fontWeight: 600, marginBottom: 6 }}>{label}</p>
      {visible.map(p => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: p.fill, flexShrink: 0 }} />
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>{p.name}</span>
          </span>
          <span style={{ fontWeight: 500, tabularNums: true } as React.CSSProperties}>{p.value}</span>
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

export default function EventsStackedBar({ orgs, events, height = 220 }: EventsStackedBarProps) {
  const [view, setView] = useState<'year' | 'month'>('year')
  const [mounted, setMounted] = useState(false)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true) }, [])

  const chartData = view === 'year' ? buildYearData(orgs, events) : buildMonthData(orgs, events)

  if (!mounted) {
    return <div style={{ height }} className="flex items-center justify-center text-xs text-muted-foreground">Loading…</div>
  }

  if (!events.length) {
    return <div style={{ height }} className="flex items-center justify-center text-xs text-muted-foreground">No data</div>
  }

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center gap-1 w-fit rounded-md border bg-muted/40 p-0.5">
        {(['year', 'month'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors capitalize ${
              view === v
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <XAxis
              dataKey="period"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
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
