'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export interface IPOChartRow {
  name:            string
  inAcademy:       number
  missingUpcoming: number
  missingOngoing:  number
  missingPast:     number
}

const COLORS = {
  inAcademy:       'hsl(142 76% 36%)',  // green
  missingUpcoming: 'hsl(38 92% 50%)',   // amber — primary focus
  missingOngoing:  'hsl(221 83% 53%)',  // blue
  missingPast:     'hsl(215 16% 65%)',  // muted gray
}

function CustomTooltip({ active, payload, label }: {
  active?:  boolean
  payload?: { name: string; value: number; fill: string }[]
  label?:   string
}) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + p.value, 0)
  return (
    <div className="rounded-md border bg-background p-3 shadow-md text-xs space-y-1 max-w-[220px]">
      <p className="font-semibold text-sm truncate">{label}</p>
      {payload.map(p => p.value > 0 && (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.fill }} />
            {p.name}
          </span>
          <span className="tabular-nums font-medium">{p.value}</span>
        </div>
      ))}
      <div className="border-t pt-1 flex justify-between">
        <span className="text-muted-foreground">Total</span>
        <span className="tabular-nums font-medium">{total}</span>
      </div>
    </div>
  )
}

export default function IPOCoverageChart({ data }: { data: IPOChartRow[] }) {
  const rowHeight   = 44
  const chartHeight = Math.max(300, data.length * rowHeight + 60)

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
        barSize={18}
      >
        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={160}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
        <Legend
          iconType="square"
          iconSize={10}
          wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
        />
        <Bar dataKey="inAcademy"       name="In Academy"        stackId="a" fill={COLORS.inAcademy}       radius={0} />
        <Bar dataKey="missingOngoing"  name="Missing · Ongoing"  stackId="a" fill={COLORS.missingOngoing}  radius={0} />
        <Bar dataKey="missingPast"     name="Missing · Past"     stackId="a" fill={COLORS.missingPast}     radius={0} />
        <Bar dataKey="missingUpcoming" name="Missing · Upcoming" stackId="a" fill={COLORS.missingUpcoming} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
