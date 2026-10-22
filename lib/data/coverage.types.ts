export interface CoverageRow {
  ipoId:     string
  name:      string
  colorHex:  string | null
  total:     number
  inAcademy: number
  upcoming:  number   // missing from the Academy, by event status
  ongoing:   number
  past:      number
  other:     number   // cancelled or postponed
}

export function coveragePct(row: { inAcademy: number; total: number }): number {
  return row.total === 0 ? 0 : (row.inAcademy / row.total) * 100
}

export function formatPct(value: number): string {
  return `${Math.round(value * 10) / 10}%`
}

export function sumCoverage(rows: CoverageRow[]): Omit<CoverageRow, 'ipoId' | 'name' | 'colorHex'> {
  return rows.reduce(
    (t, r) => ({
      total:     t.total     + r.total,
      inAcademy: t.inAcademy + r.inAcademy,
      upcoming:  t.upcoming  + r.upcoming,
      ongoing:   t.ongoing   + r.ongoing,
      past:      t.past      + r.past,
      other:     t.other     + r.other,
    }),
    { total: 0, inAcademy: 0, upcoming: 0, ongoing: 0, past: 0, other: 0 },
  )
}
