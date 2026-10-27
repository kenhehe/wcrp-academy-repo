'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import StatusBadge from '@/components/base/StatusBadge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { coveragePct, formatPct, sumCoverage } from '@/lib/data/coverage.types'
import type { CoverageTableProps } from './types'

type SortKey = 'upcoming' | 'coverage'

interface Counts {
  total:     number
  inAcademy: number
  upcoming:  number
  ongoing:   number
  past:      number
  other:     number
}

function CoverageCell({ name, counts }: { name: string; counts: Counts }) {
  const pct = coveragePct(counts)
  return (
    <div className="flex items-center gap-3">
      <div
        role="img"
        aria-label={`${name} coverage ${formatPct(pct)}, ${counts.inAcademy} of ${counts.total} events in the Academy`}
        className="h-2 w-36 shrink-0 overflow-hidden rounded-full bg-accent"
      >
        <div className="h-full min-w-[3px] rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 font-semibold tabular-nums">{formatPct(pct)}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{counts.inAcademy} of {counts.total}</span>
    </div>
  )
}

function UpcomingCell({ count }: { count: number }) {
  if (count === 0) return <StatusBadge tone="success" icon={Check}>None</StatusBadge>
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-xl font-semibold leading-none tabular-nums text-warning">{count}</span>
      <span className="text-xs text-muted-foreground">to add</span>
    </span>
  )
}

function PastCell({ counts }: { counts: Counts }) {
  return (
    <div className="text-muted-foreground tabular-nums">
      {counts.past.toLocaleString('en-GB')}
      {counts.other > 0 && (
        <span className="block text-xs">+{counts.other} cancelled or postponed</span>
      )}
    </div>
  )
}

export default function CoverageTable({ rows }: CoverageTableProps) {
  const [sort, setSort] = useState<SortKey>('upcoming')

  const sorted = [...rows].sort((a, b) => sort === 'coverage'
    ? coveragePct(a) - coveragePct(b)
    : (b.upcoming - a.upcoming) || (b.ongoing - a.ongoing) || (coveragePct(a) - coveragePct(b)))
  const totals = sumCoverage(rows)

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="flex flex-wrap items-start justify-between gap-3 pb-4">
        <div className="max-w-2xl space-y-1">
          <CardTitle>Academy coverage by IPO</CardTitle>
          <CardDescription>
            {sort === 'coverage'
              ? 'Sorted by lowest coverage first.'
              : 'Sorted by upcoming events still missing, the ones to add first.'}
            {' '}Coverage is the share of each IPO&apos;s events already in the Academy.
          </CardDescription>
        </div>
        <div role="group" aria-label="Sort IPOs" className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort by</span>
          <Button
            size="sm"
            variant={sort === 'upcoming' ? 'default' : 'outline'}
            aria-pressed={sort === 'upcoming'}
            onClick={() => setSort('upcoming')}
          >
            Upcoming missing
          </Button>
          <Button
            size="sm"
            variant={sort === 'coverage' ? 'default' : 'outline'}
            aria-pressed={sort === 'coverage'}
            onClick={() => setSort('coverage')}
          >
            Lowest coverage
          </Button>
        </div>
      </CardHeader>

      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="pl-4">IPO</TableHead>
            <TableHead>Coverage</TableHead>
            <TableHead className="text-right">Upcoming missing</TableHead>
            <TableHead className="text-right">Ongoing missing</TableHead>
            <TableHead className="text-right">Past missing</TableHead>
            <TableHead className="pr-4"><span className="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map(row => (
            <TableRow key={row.ipoId}>
              <TableCell className="pl-4">
                <span className="flex items-center gap-2 font-medium">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: row.colorHex ?? 'var(--muted-foreground)' }}
                  />
                  {row.name}
                </span>
              </TableCell>
              <TableCell><CoverageCell name={row.name} counts={row} /></TableCell>
              <TableCell className="text-right"><UpcomingCell count={row.upcoming} /></TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">{row.ongoing}</TableCell>
              <TableCell className="text-right"><PastCell counts={row} /></TableCell>
              <TableCell className="pr-4 text-right">
                {row.upcoming > 0 && (
                  <Link
                    href={`/dashboard/academy/gaps?ipo=${row.ipoId}&status=Upcoming#missing`}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    Review
                  </Link>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow className="hover:bg-transparent">
            <TableCell className="pl-4 font-semibold">All IPOs</TableCell>
            <TableCell><CoverageCell name="All IPOs" counts={totals} /></TableCell>
            <TableCell className="text-right"><UpcomingCell count={totals.upcoming} /></TableCell>
            <TableCell className="text-right text-muted-foreground tabular-nums">{totals.ongoing}</TableCell>
            <TableCell className="text-right"><PastCell counts={totals} /></TableCell>
            <TableCell className="pr-4" />
          </TableRow>
        </TableFooter>
      </Table>
    </Card>
  )
}
