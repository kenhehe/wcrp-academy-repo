'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import type { EventsStackedBarProps } from './types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function buildMonthData(
  orgs:       EventsStackedBarProps['orgs'],
  events:     EventsStackedBarProps['events'],
  yearFilter: number | null,
) {
  const filtered = yearFilter != null ? events.filter(e => e.year === yearFilter) : events

  // Pre-compute lookup: `${org_id}-${month}` → count
  const lookup = new Map<string, number>()
  for (const e of filtered) {
    if (e.month != null) {
      const key = `${e.org_id}-${e.month}`
      lookup.set(key, (lookup.get(key) ?? 0) + 1)
    }
  }

  return MONTHS.map((label, i) => {
    const month = i + 1
    const row: Record<string, string | number> = { period: label }
    for (const org of orgs) {
      row[org.id] = lookup.get(`${org.id}-${month}`) ?? 0
    }
    return row
  })
}

function orgTotal(
  org:        EventsStackedBarProps['orgs'][number],
  events:     EventsStackedBarProps['events'],
  yearFilter: number | null,
) {
  const filtered = yearFilter != null ? events.filter(e => e.year === yearFilter) : events
  return filtered.filter(e => e.org_id === org.id).length
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
      <p style={{ fontWeight: 600, marginBottom: 6 }}>{label}</p>
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

export default function EventsStackedBar({ orgs, events, height = 220 }: EventsStackedBarProps) {
  const [yearFilter, setYearFilter] = useState<number | null>(null)
  const [mounted,    setMounted]    = useState(false)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true) }, [])

  const years = [...new Set(
    events.map(e => e.year).filter((y): y is number => y != null)
  )].sort()

  const chartData = buildMonthData(orgs, events, yearFilter)

  if (!mounted) {
    return <div style={{ height }} className="flex items-center justify-center text-xs text-muted-foreground">Loading…</div>
  }

  if (!events.length) {
    return <div style={{ height }} className="flex items-center justify-center text-xs text-muted-foreground">No data</div>
  }

  return (
    <div className="space-y-4">

      {/* Year filter */}
      <div className="flex items-center gap-1 flex-wrap">
        <button
          onClick={() => setYearFilter(null)}
          className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
            yearFilter === null
              ? 'bg-foreground text-background border-foreground'
              : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
          }`}
        >
          All
        </button>
        {years.map(y => (
          <button
            key={y}
            onClick={() => setYearFilter(y)}
            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
              yearFilter === y
                ? 'bg-foreground text-background border-foreground'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
            }`}
          >
            {y}
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

      {/* Legend with counts */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {orgs.map(org => {
          const count = orgTotal(org, events, yearFilter)
          return (
            <div key={org.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: org.color }} />
              <span>{org.name}</span>
              <span className="tabular-nums text-foreground/60">({count})</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
