'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import type { ChartBarProps } from './types'

interface ActiveBar {
  label: string
  value: number
}

export default function ChartBar({
  data,
  color  = 'hsl(var(--primary))',
  height = 180,
}: ChartBarProps) {
  const [mounted,   setMounted]   = useState(false)
  const [mouse,     setMouse]     = useState({ x: 0, y: 0 })
  const [activeBar, setActiveBar] = useState<ActiveBar | null>(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true) }, [])

  if (!data.length) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-xs text-muted-foreground"
      >
        No data
      </div>
    )
  }

  return (
    <div
      style={{ width: '100%', height }}
      onMouseMove={e => setMouse({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setActiveBar(null)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <XAxis
            dataKey="name"
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
          <Bar
            dataKey="value"
            fill={color}
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
            onMouseEnter={(entry: unknown) => {
              const e = entry as { name?: unknown; value?: unknown }
              setActiveBar({
                label: String(e.name ?? ''),
                value: Number(e.value ?? 0),
              })
            }}
            onMouseLeave={() => setActiveBar(null)}
          />
        </BarChart>
      </ResponsiveContainer>

      {mounted && activeBar && createPortal(
        <div
          style={{
            position: 'fixed',
            left: mouse.x + 14,
            top:  mouse.y - 52,
            zIndex: 9999,
            pointerEvents: 'none',
            background: 'var(--background)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 12,
            color: 'var(--foreground)',
            boxShadow: '0 2px 8px rgb(0 0 0 / 0.08)',
            whiteSpace: 'nowrap',
          }}
        >
          <p style={{ fontWeight: 500, marginBottom: 2 }}>{activeBar.label}</p>
          <p style={{ color: 'hsl(var(--muted-foreground))' }}>{activeBar.value} events</p>
        </div>,
        document.body
      )}
    </div>
  )
}
