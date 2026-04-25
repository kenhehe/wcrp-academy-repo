'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { StatusDonutProps } from './types'

// Chart-only color constants — not UI colors
const COLORS = {
  Upcoming: '#2563eb',
  Ongoing:  '#16a34a',
  Past:     '#94a3b8',
}

export default function StatusDonut({ upcoming, ongoing, past }: StatusDonutProps) {
  const data = [
    { name: 'Upcoming', value: upcoming },
    { name: 'Ongoing',  value: ongoing },
    { name: 'Past',     value: past },
  ].filter(d => d.value > 0)

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No event data
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map(entry => (
              <Cell
                key={entry.name}
                fill={COLORS[entry.name as keyof typeof COLORS]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [value, 'events']}
            wrapperStyle={{ zIndex: 9999 }}
            contentStyle={{
              fontSize: 12,
              background: 'var(--background)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
              borderRadius: 6,
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span style={{ fontSize: 12 }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
