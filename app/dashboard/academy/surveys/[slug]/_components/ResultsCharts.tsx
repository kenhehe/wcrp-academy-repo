// Server-rendered chart pieces for the Results tab, in plain HTML: a before/after dumbbell
// (before = ring, after = filled dot, one hue) and simple horizontal bars. Hover and
// keyboard focus show a tooltip (CSS only); every value is also in the visible labels or
// the "Show as a table" view. Marks use colour tokens; text uses text tokens.
import type { PairedScale } from '@/lib/data/survey-results'

const pos = (v: number) => `${((v - 1) / 4) * 100}%`
export const fmt = (v: number | null) => (v === null ? '—' : v.toFixed(1))
export const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(1)}`
export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

export const TOOLTIP = 'pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap text-popover-foreground group-hover:block group-focus:block'

export function DumbbellLegend() {
  return (
    <p className="flex items-center gap-4 text-xs text-muted-foreground" aria-hidden="true">
      <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full border-2 border-primary bg-card" /> Before</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-primary" /> After</span>
      <span>Average on the 1–5 scale, people who answered both</span>
    </p>
  )
}

export function Dumbbell({ scales }: { scales: PairedScale[] }) {
  const rows = scales.filter(s => s.before !== null && s.after !== null)
  return (
    <div className="space-y-1">
      {rows.map(s => {
        const before = s.before!, after = s.after!
        const label = `${s.text}: before ${fmt(before)}, after ${fmt(after)} (${signed(after - before)}), ${s.n} people; ${s.higher} higher, ${s.same} same, ${s.lower} lower`
        return (
          <div key={s.versionId} className="grid grid-cols-1 items-center gap-x-6 gap-y-1 py-2 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_7rem]">
            <div className="text-sm">
              {s.text}
              <span className="block text-xs text-muted-foreground">
                {s.n} people · {s.higher} higher, {s.same} same, {s.lower} lower{!s.isCore && ' · this event\'s question'}
              </span>
            </div>
            <div tabIndex={0} aria-label={label} className="group relative h-9 rounded outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              {[1, 2, 3, 4, 5].map(k => (
                <span key={k} className="absolute inset-y-1.5 w-px bg-border" style={{ left: pos(k) }} />
              ))}
              <span className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-muted-foreground/50" style={{ left: pos(Math.min(before, after)), width: `${(Math.abs(after - before) / 4) * 100}%` }} />
              <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-card" style={{ left: pos(before) }} />
              <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-card" style={{ left: pos(after) }} />
              <div role="tooltip" className={TOOLTIP}>
                <strong className="text-sm">{fmt(before)} → {fmt(after)}</strong>
                <span className="text-muted-foreground"> before → after · {s.n} people</span>
              </div>
            </div>
            <div className="text-sm md:text-right">
              <span className="font-semibold tabular-nums">{fmt(before)} → {fmt(after)}</span>
              <span className="ml-2 text-xs text-muted-foreground tabular-nums md:ml-0 md:block">{signed(after - before)}</span>
            </div>
          </div>
        )
      })}
      <div className="hidden grid-cols-[minmax(0,18rem)_minmax(0,1fr)_7rem] gap-x-6 md:grid" aria-hidden="true">
        <span />
        <div className="relative h-4 text-xs text-muted-foreground">
          {[1, 2, 3, 4, 5].map(k => (
            <span key={k} className="absolute -translate-x-1/2 tabular-nums" style={{ left: pos(k) }}>{k}</span>
          ))}
        </div>
        <span />
      </div>
    </div>
  )
}

// One bar per item, longest = whole width; the value sits at the bar's tip
export function BarList({ items, total }: { items: { label: string; count: number }[]; total: number }) {
  const max = Math.max(1, ...items.map(i => i.count))
  return (
    <ul className="space-y-2">
      {items.map(i => (
        <li key={i.label} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] items-center gap-3 text-sm">
          <span className="truncate text-muted-foreground" title={i.label}>{i.label}</span>
          <span tabIndex={0} aria-label={`${i.label}: ${pct(i.count, total)}%, ${i.count} people`} className="group relative flex items-center gap-2 rounded outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <span className="h-3 rounded-r-[4px] bg-primary" style={{ width: `${(i.count / max) * 80}%`, minWidth: i.count ? 3 : 0 }} />
            <span className="text-xs tabular-nums text-muted-foreground">{pct(i.count, total)}%</span>
            <span role="tooltip" className={TOOLTIP}><strong className="text-sm">{pct(i.count, total)}%</strong><span className="text-muted-foreground"> · {i.count} people</span></span>
          </span>
        </li>
      ))}
    </ul>
  )
}
