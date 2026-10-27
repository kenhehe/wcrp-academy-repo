'use client'

import { Fragment, useState } from 'react'
import { ChartColumn, ChevronLeft, ChevronRight, Minus, Table2, TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import OrgDot from '@/components/base/OrgDot'
import { cn } from '@/lib/utils'
import { monthName } from '@/lib/data/event-trends'
import type { EventActivityProps } from './types'

// Events per year (click one for its months and organisations). Shared by Climate Analytics
// (IPO tree) and the Academy overview, which also passes data.inAcademy: then each column's
// lower, darker part is the events already in the Academy, above a 2px gap.

type Selection = number | 'all'
type View      = 'chart' | 'table'

const YEAR_PLOT  = 200   // px: column height for the busiest year's axis maximum
const YEAR_AXIS  = 28    // px: the year label band under the columns
const MONTH_PLOT = 140
const MONTH_AXIS = 24
const BAR = 'absolute left-1/2 w-[min(24px,64%)] -translate-x-1/2'

function niceMax(value: number): number {
  for (const step of [4, 5, 8, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500]) {
    if (step >= value) return step
  }
  return Math.ceil(value / 100) * 100
}

function ticksFor(max: number): number[] {
  if (max >= 30 && max % 3 === 0) return [0, max / 3, (2 * max) / 3, max]
  return max % 2 === 0 ? [0, max / 2, max] : [0, max]
}

const sum         = (counts: Record<string, number> | undefined) => Object.values(counts ?? {}).reduce((a, b) => a + b, 0)
const eventsLabel = (n: number) => `${n.toLocaleString('en-GB')} ${n === 1 ? 'event' : 'events'}`

function yearChange(year: number, total: number, previous: number | null) {
  if (previous === null) return { direction: null, text: 'First year on record' }
  const diff = total - previous
  if (diff === 0) return { direction: 'flat' as const, text: `Same as ${year - 1}` }
  const pct = previous > 0 ? ` (${diff > 0 ? '+' : '−'}${Math.round((Math.abs(diff) / previous) * 100)}%)` : ''
  if (diff > 0) {
    return { direction: 'up' as const, text: previous === 0 ? `${diff} more than ${year - 1}, which had none` : `${diff} more than ${year - 1}${pct}` }
  }
  return { direction: 'down' as const, text: `${-diff} fewer than ${year - 1}${pct}` }
}

const CHANGE_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus }

const ORG_GROUPS = [
  { type: 'ipo',        label: 'IPOs',                  one: 'IPO',                  many: 'IPOs' },
  { type: 'lighthouse', label: 'Lighthouse Activities', one: 'Lighthouse programme', many: 'Lighthouse programmes' },
] as const

function Gridlines({ max, plot, axis }: { max: number; plot: number; axis: number }) {
  return (
    <>
      {ticksFor(max).map(tick => {
        const bottom = axis + (tick / max) * plot
        return (
          <Fragment key={tick}>
            <span
              aria-hidden="true"
              className={cn('pointer-events-none absolute right-0 left-10 h-px', tick === 0 ? 'bg-border' : 'bg-border/60')}
              style={{ bottom }}
            />
            <span
              aria-hidden="true"
              className="absolute left-0 w-8 translate-y-1/2 text-right text-[11px] tabular-nums text-muted-foreground"
              style={{ bottom }}
            >
              {tick}
            </span>
          </Fragment>
        )
      })}
    </>
  )
}

// One column, anchored to the baseline. Given an Academy count, that part sits at the bottom
// in --primary and the rest above it in --scale-1 (lighter in light mode, darker in dark).
function ColumnBar({ count, academy, max, dim = false }: { count: number; academy?: number; max: number; dim?: boolean }) {
  if (count === 0) return null
  const pct = (count / max) * 100
  if (academy === undefined) {
    return <span className={cn(BAR, 'bottom-0 rounded-t-[4px]', dim ? 'bg-primary/35' : 'bg-primary')} style={{ height: `max(3px, ${pct}%)` }} />
  }
  const inPct = (academy / max) * 100
  const rest  = count - academy
  return (
    <>
      {academy > 0 && (
        <span className={cn(BAR, 'bottom-0 bg-primary', rest === 0 && 'rounded-t-[4px]', dim && 'opacity-35')} style={{ height: `max(2px, ${inPct}%)` }} />
      )}
      {rest > 0 && (
        <span
          className={cn(BAR, 'rounded-t-[4px] bg-[var(--scale-1)]', dim && 'opacity-35')}
          style={academy > 0
            ? { bottom: `calc(max(2px, ${inPct}%) + 2px)`, height: `max(2px, calc(${pct - inPct}% - 2px))` }
            : { bottom: 0, height: `max(3px, ${pct}%)` }}
        />
      )}
    </>
  )
}

function AcademyLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-[3px] bg-primary" />In the Academy</span>
      <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-[3px] bg-[var(--scale-1)]" />Not in the Academy</span>
    </div>
  )
}

function YearChart({ years, counts, academy, selected, hovered, onSelect, onHover }: {
  years:    number[]
  counts:   number[]
  academy?: number[]   // per year, in the Academy
  selected: Selection
  hovered:  number | null
  onSelect: (selection: Selection) => void
  onHover:  (year: number | null) => void
}) {
  const max  = niceMax(Math.max(...counts, 1))
  const peak = Math.max(...counts)
  return (
    <div className="overflow-x-auto">
      <div className="relative min-w-[960px] pt-[72px] pl-10">
        <Gridlines max={max} plot={YEAR_PLOT} axis={YEAR_AXIS} />
        <div className="relative grid" style={{ gridTemplateColumns: `repeat(${years.length}, minmax(0, 1fr))` }}>
          {years.map((year, i) => {
            const count      = counts[i]
            const pct        = (count / max) * 100
            const isSelected = selected === year
            const emphasised = selected === 'all' || isSelected
            return (
              <button
                key={year}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${year}, ${eventsLabel(count)}${academy ? `, ${academy[i]} in the Academy` : ''}. Show breakdown`}
                onClick={() => onSelect(isSelected ? 'all' : year)}
                onMouseEnter={() => onHover(year)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(year)}
                onBlur={() => onHover(null)}
                className="relative flex cursor-pointer flex-col justify-end rounded-md outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
                style={{ height: YEAR_PLOT + YEAR_AXIS }}
              >
                <span className="relative block w-full" style={{ height: YEAR_PLOT }}>
                  <ColumnBar count={count} academy={academy?.[i]} max={max} dim={!emphasised} />
                  {count > 0 && (isSelected || (selected === 'all' && count === peak)) && (
                    <span
                      className="absolute -inset-x-3 text-center text-xs font-semibold tabular-nums"
                      style={{ bottom: `calc(${pct}% + 4px)` }}
                    >
                      {count}
                    </span>
                  )}
                  {hovered === year && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-center whitespace-nowrap text-popover-foreground"
                      style={{ bottom: `calc(${pct}% + 26px)` }}
                    >
                      <span className="block text-[13px] font-semibold">{eventsLabel(count)}</span>
                      {academy && <span className="block text-xs">{academy[i]} in the Academy</span>}
                      <span className="block text-xs text-muted-foreground">{year}</span>
                    </span>
                  )}
                </span>
                <span
                  className={cn('text-[11px] tabular-nums', isSelected ? 'font-semibold text-foreground' : 'text-muted-foreground')}
                  style={{ height: YEAR_AXIS, lineHeight: `${YEAR_AXIS}px` }}
                >
                  {year}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MonthChart({ months, academy, label }: { months: number[]; academy?: number[]; label: string }) {
  const max     = niceMax(Math.max(...months, 1))
  const peak    = Math.max(...months)
  const peakIdx = months.indexOf(peak)
  return (
    <div role="img" aria-label={label} className="relative pt-8 pl-10">
      <Gridlines max={max} plot={MONTH_PLOT} axis={MONTH_AXIS} />
      <div className="relative grid grid-cols-12">
        {months.map((count, m) => {
          const pct = (count / max) * 100
          return (
            <div
              key={m}
              title={`${monthName(m, true)}: ${eventsLabel(count)}${academy ? `, ${academy[m]} in the Academy` : ''}`}
              className="flex flex-col justify-end"
              style={{ height: MONTH_PLOT + MONTH_AXIS }}
            >
              <span className="relative block w-full" style={{ height: MONTH_PLOT }}>
                <ColumnBar count={count} academy={academy?.[m]} max={max} />
                {count > 0 && m === peakIdx && (
                  <span className="absolute -inset-x-3 text-center text-xs font-semibold tabular-nums" style={{ bottom: `calc(${pct}% + 4px)` }}>
                    {count}
                  </span>
                )}
              </span>
              <span className="text-center text-[11px] text-muted-foreground" style={{ height: MONTH_AXIS, lineHeight: `${MONTH_AXIS}px` }}>
                {monthName(m)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function EventActivity({ data, summary }: EventActivityProps) {
  const { currentYear, years, byYear, byYearMonth, upcomingByYear, orgs, inAcademy } = data
  const [selected, setSelected] = useState<Selection>(years.includes(currentYear) ? currentYear : 'all')
  const [view, setView]         = useState<View>('chart')
  const [hovered, setHovered]   = useState<number | null>(null)

  const counts      = years.map(year => sum(byYear[year]))
  const academy     = inAcademy && years.map(year => inAcademy.byYear[year] ?? 0)
  const peak        = Math.max(...counts)
  const busiestYear = years[counts.indexOf(peak)]
  const lastYear    = years[years.length - 1]
  const year        = selected === 'all' ? null : selected

  // Breakdown for the selected year, or every year combined
  const orgCounts: Record<string, number> = {}
  for (const y of year === null ? years : [year]) {
    for (const [id, n] of Object.entries(byYear[y] ?? {})) orgCounts[id] = (orgCounts[id] ?? 0) + n
  }
  const orgRows = orgs
    .filter(org => (orgCounts[org.id] ?? 0) > 0)
    .map(org => ({ org, count: orgCounts[org.id] }))
    .sort((a, b) => (b.count - a.count) || a.org.name.localeCompare(b.org.name))
  const total  = orgRows.reduce((s, r) => s + r.count, 0)
  const orgMax = orgRows[0]?.count ?? 1   // one scale for both groups, so bar lengths compare across them
  // Only the kinds of organisation the data has (the Academy overview shows IPOs alone)
  const groups = ORG_GROUPS.filter(group => orgs.some(org => org.type === group.type)).map(group => {
    const rows = orgRows.filter(r => r.org.type === group.type)
    return { ...group, rows, total: rows.reduce((s, r) => s + r.count, 0) }
  })
  const monthsOf = (perYear: Record<number, number[]>) => year === null
    ? Array.from({ length: 12 }, (_, m) => years.reduce((s, y) => s + (perYear[y]?.[m] ?? 0), 0))
    : (perYear[year] ?? Array<number>(12).fill(0))
  const months        = monthsOf(byYearMonth)
  const academyMonths = inAcademy && monthsOf(inAcademy.byYearMonth)
  const academyTotal  = academyMonths?.reduce((s, n) => s + n, 0) ?? 0
  const busiest = Math.max(...months)
  const busiestMonth = months.indexOf(busiest)

  const change = year === null ? null : yearChange(year, total, year === years[0] ? null : sum(byYear[year - 1]))
  const ChangeIcon = change?.direction ? CHANGE_ICON[change.direction] : null
  const note = year === null ? null
    : year === currentYear && (upcomingByYear[year] ?? 0) > 0 ? `Includes ${upcomingByYear[year]} still to come`
    : year > currentYear ? 'Only events announced so far'
    : null

  return (
    <section aria-labelledby="activity-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 id="activity-title" className="text-lg font-semibold">Event activity</h2>
          <p className="text-sm text-muted-foreground">{summary}</p>
        </div>
        <div role="group" aria-label="Show as" className="flex gap-2">
          <Button variant={view === 'chart' ? 'default' : 'outline'} size="sm" aria-pressed={view === 'chart'} onClick={() => setView('chart')}>
            <ChartColumn data-icon="inline-start" aria-hidden="true" />
            Chart
          </Button>
          <Button variant={view === 'table' ? 'default' : 'outline'} size="sm" aria-pressed={view === 'table'} onClick={() => setView('table')}>
            <Table2 data-icon="inline-start" aria-hidden="true" />
            Table
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Events per year</CardTitle>
          <CardDescription>
            Click a year to see its breakdown below.
            {lastYear > currentYear && ` ${lastYear} only counts events announced so far.`}
          </CardDescription>
          <CardAction>
            <Button variant={selected === 'all' ? 'default' : 'outline'} size="sm" aria-pressed={selected === 'all'} onClick={() => setSelected('all')}>
              All years
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          {academy && view === 'chart' && <AcademyLegend />}
          {view === 'chart' ? (
            <YearChart years={years} counts={counts} academy={academy} selected={selected} hovered={hovered} onSelect={setSelected} onHover={setHovered} />
          ) : (
            <div className="max-h-[360px] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Year</TableHead>
                    <TableHead className="text-right">Events</TableHead>
                    {academy && <TableHead className="text-right">In the Academy</TableHead>}
                    <TableHead className="pr-4 text-right">Change from previous year</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {years.map((y, i) => ({ y, i })).reverse().map(({ y, i }) => {
                    const diff = i === 0 ? null : counts[i] - counts[i - 1]
                    return (
                      <TableRow key={y} data-state={selected === y ? 'selected' : undefined}>
                        <TableCell className="pl-4">
                          <Button variant="link" size="sm" className="px-0" aria-pressed={selected === y} onClick={() => setSelected(y)}>
                            {y}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{counts[i]}</TableCell>
                        {academy && <TableCell className="text-right tabular-nums">{academy[i]}</TableCell>}
                        <TableCell className="pr-4 text-right tabular-nums text-muted-foreground">
                          {diff === null ? 'First year' : diff > 0 ? `+${diff}` : diff < 0 ? `−${-diff}` : '0'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card aria-live="polite">
        <CardHeader className="border-b">
          <p className="text-xs font-medium text-muted-foreground">Breakdown</p>
          <h3 className="flex flex-wrap items-baseline gap-x-3 text-2xl font-semibold">
            {year ?? 'All years'}
            <span>{total.toLocaleString('en-GB')}</span>
            <span className="text-base font-medium text-muted-foreground">{total === 1 ? 'event' : 'events'}</span>
          </h3>
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {ChangeIcon && <ChangeIcon className="size-4" aria-hidden="true" />}
            <span>
              {change ? change.text : `${years[0]} to ${lastYear}. Busiest year: ${busiestYear} with ${eventsLabel(peak)}`}
            </span>
            {note && <span>· {note}</span>}
          </p>
          {inAcademy && total > 0 && (
            <p className="text-sm text-muted-foreground">
              {academyTotal} in the Academy ({Math.round((academyTotal / total) * 1000) / 10}%)
            </p>
          )}
          {year !== null && (
            <CardAction className="flex gap-2">
              <Button variant="outline" size="icon" aria-label="Previous year" disabled={year <= years[0]} onClick={() => setSelected(year - 1)}>
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button variant="outline" size="icon" aria-label="Next year" disabled={year >= lastYear} onClick={() => setSelected(year + 1)}>
                <ChevronRight aria-hidden="true" />
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No events start in {year}.</p>
          ) : (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div className="min-w-0 space-y-3">
                <div>
                  <h4 className="text-sm font-semibold">By organisation</h4>
                  <p className="text-sm text-muted-foreground">
                    {groups.map(g => `${g.rows.length} ${g.rows.length === 1 ? g.one : g.many}`).join(' and ')} with events{year === null ? '' : ` in ${year}`}
                  </p>
                </div>
                {view === 'chart' ? (
                  <div className="space-y-5">
                    {groups.map(group => (
                      <section key={group.type} aria-label={group.label} className="space-y-2">
                        <div className="flex items-baseline justify-between gap-3 border-b pb-1.5">
                          <h5 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group.label}</h5>
                          <span className="text-xs tabular-nums text-muted-foreground">{eventsLabel(group.total)}</span>
                        </div>
                        {group.rows.length === 0 ? (
                          <p className="text-sm text-muted-foreground">None{year === null ? '' : ` in ${year}`}</p>
                        ) : (
                          <ul className="space-y-2">
                            {group.rows.map(({ org, count }) => (
                              <li key={org.id} className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)] items-center gap-3 text-sm">
                                <span className="flex min-w-0 items-center gap-2">
                                  <OrgDot color={org.color} />
                                  <span className="truncate" title={org.name}>{org.name}</span>
                                </span>
                                <span className="flex items-center gap-2">
                                  <span className="h-3 min-w-[3px] rounded-r-[4px] bg-primary" style={{ width: `calc((100% - 3rem) * ${count / orgMax})` }} />
                                  <span className="text-xs font-semibold tabular-nums">{count}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">Organisation</TableHead>
                          <TableHead className="text-right">Events</TableHead>
                          <TableHead className="pr-4 text-right">Share</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groups.filter(group => group.rows.length > 0).map(group => (
                          <Fragment key={group.type}>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                              <TableCell className="pl-4 text-xs font-semibold">{group.label}</TableCell>
                              <TableCell className="text-right text-xs font-semibold tabular-nums">{group.total}</TableCell>
                              <TableCell className="pr-4 text-right text-xs tabular-nums text-muted-foreground">
                                {Math.round((group.total / total) * 1000) / 10}%
                              </TableCell>
                            </TableRow>
                            {group.rows.map(({ org, count }) => (
                              <TableRow key={org.id}>
                                <TableCell className="pl-6">
                                  <span className="flex items-center gap-2"><OrgDot color={org.color} />{org.name}</span>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{count}</TableCell>
                                <TableCell className="pr-4 text-right tabular-nums text-muted-foreground">
                                  {Math.round((count / total) * 1000) / 10}%
                                </TableCell>
                              </TableRow>
                            ))}
                          </Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div className="min-w-0 space-y-3">
                <div>
                  <h4 className="text-sm font-semibold">By month</h4>
                  <p className="text-sm text-muted-foreground">
                    Busiest month: {monthName(busiestMonth, true)} ({eventsLabel(busiest)})
                  </p>
                </div>
                {view === 'chart' ? (
                  <MonthChart
                    months={months}
                    academy={academyMonths}
                    label={`Events by month${year === null ? ', all years' : ` in ${year}`}: ${months.map((n, m) => `${monthName(m)} ${n}${academyMonths ? ` (${academyMonths[m]} in the Academy)` : ''}`).join(', ')}`}
                  />
                ) : (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">Month</TableHead>
                          <TableHead className={cn('text-right', !academyMonths && 'pr-4')}>Events</TableHead>
                          {academyMonths && <TableHead className="pr-4 text-right">In the Academy</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {months.map((n, m) => (
                          <TableRow key={m}>
                            <TableCell className="pl-4">{monthName(m, true)}</TableCell>
                            <TableCell className={cn('text-right tabular-nums', !academyMonths && 'pr-4')}>{n}</TableCell>
                            {academyMonths && <TableCell className="pr-4 text-right tabular-nums">{academyMonths[m]}</TableCell>}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
