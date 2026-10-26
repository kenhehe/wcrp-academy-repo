'use client'

// The Results tab's interactive parts: answer shifts on the 1–5 scale (pick a question),
// the career stage / region breakdown, and participants' own words (searchable).
import { useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { BreakdownRow, PairedScale, TextPair } from '@/lib/data/survey-results'
import { cn } from '@/lib/utils'
import { TOOLTIP, fmt, signed } from './ResultsCharts'

function QuestionPicker({ scales, value, onChange, label }: { scales: PairedScale[]; value: string; onChange: (v: string) => void; label: string }) {
  const items = Object.fromEntries(scales.map(s => [s.versionId, s.text]))
  return (
    <Select value={value} onValueChange={v => { if (v) onChange(v) }} items={items}>
      <SelectTrigger className="w-full max-w-xl" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        {scales.map(s => <SelectItem key={s.versionId} value={s.versionId}>{s.text}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

// Two 100% bars (before, after) split into the five answers, on the ordinal --scale-N ramp
export function ShiftChart({ scales }: { scales: PairedScale[] }) {
  const [id, setId] = useState(scales[0]?.versionId ?? '')
  const q = scales.find(s => s.versionId === id) ?? scales[0]
  if (!q) return null
  const rows: [string, number[]][] = [['Before', q.dist.before], ['After', q.dist.after]]

  return (
    <div className="space-y-4">
      <QuestionPicker scales={scales} value={q.versionId} onChange={setId} label="Question" />
      <div className="space-y-3">
        {rows.map(([label, counts]) => {
          const total = counts.reduce((a, b) => a + b, 0)
          const parts = counts.map((count, k) => ({ k: k + 1, count, share: total ? (count / total) * 100 : 0 })).filter(p => p.count > 0)
          return (
            <div key={label} className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-3">
              <span className="text-sm text-muted-foreground">{label}</span>
              <div className="flex h-6 gap-[2px]">
                {parts.map((p, i) => (
                  <span
                    key={p.k}
                    tabIndex={0}
                    aria-label={`${label}, answer ${p.k}: ${Math.round(p.share)}% (${p.count} people)`}
                    className={cn('group relative flex items-center justify-center text-xs font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                      i === 0 && 'rounded-l-[4px]', i === parts.length - 1 && 'rounded-r-[4px]')}
                    style={{ width: `${p.share}%`, background: `var(--scale-${p.k})`, color: `var(--scale-${p.k}-ink)` }}
                  >
                    {p.share >= 9 && `${Math.round(p.share)}%`}
                    <span role="tooltip" className={TOOLTIP}>
                      <strong className="text-sm">{Math.round(p.share)}%</strong>
                      <span className="text-muted-foreground"> answered {p.k} · {p.count} people</span>
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {[1, 2, 3, 4, 5].map(k => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-[3px]" style={{ background: `var(--scale-${k})` }} aria-hidden="true" />
            {k}{k === 1 && q.minLabel ? ` = ${q.minLabel}` : ''}{k === 5 && q.maxLabel ? ` = ${q.maxLabel}` : ''}
          </span>
        ))}
        <span>{q.n} people who answered both</span>
      </p>
    </div>
  )
}

export function BreakdownTable({ scales, breakdowns }: { scales: PairedScale[]; breakdowns: Record<string, { career: BreakdownRow[]; region: BreakdownRow[] }> }) {
  const [id, setId] = useState(scales[0]?.versionId ?? '')
  const [by, setBy] = useState<'career' | 'region'>('career')
  const rows = breakdowns[id]?.[by] ?? []
  if (scales.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <QuestionPicker scales={scales} value={id} onChange={setId} label="Question" />
        <Select value={by} onValueChange={v => { if (v) setBy(v as 'career' | 'region') }} items={{ career: 'By career stage', region: 'By region' }}>
          <SelectTrigger className="w-44" aria-label="Group by"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="career">By career stage</SelectItem>
            <SelectItem value="region">By region</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>{by === 'career' ? 'Career stage' : 'Region'}</TableHead>
            <TableHead className="text-right">People</TableHead>
            <TableHead className="text-right">Before</TableHead>
            <TableHead className="text-right">After</TableHead>
            <TableHead className="text-right">Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Nobody to break down yet.</TableCell></TableRow>
          )}
          {rows.map(r => (
            <TableRow key={r.group}>
              <TableCell>{r.group}</TableCell>
              {r.hidden ? (
                <TableCell colSpan={4} className="text-right text-sm text-muted-foreground">Fewer than 5 people: hidden to protect anonymity</TableCell>
              ) : (
                <>
                  <TableCell className="text-right tabular-nums">{r.n}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.before)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.after)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{r.before !== null && r.after !== null ? signed(r.after - r.before) : '—'}</TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function Quotes({ pairs, afterOnly }: { pairs: { text: string; pairs: TextPair[] }[]; afterOnly: { text: string; answers: { pseudonym: string; text: string }[] }[] }) {
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(20)
  const q = query.trim().toLowerCase()
  const hit = (...texts: string[]) => !q || texts.some(t => t.toLowerCase().includes(q))

  return (
    <div className="space-y-5">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search answers" aria-label="Search answers" className="pl-8" />
      </div>
      {pairs.map(group => {
        const shown = group.pairs.filter(p => hit(p.before, p.after))
        return (
          <section key={group.text} className="space-y-2">
            <h3 className="text-sm font-medium">{group.text} <span className="font-normal text-muted-foreground">· before and after, {shown.length} people</span></h3>
            <ul className="divide-y rounded-lg border">
              {shown.slice(0, limit).map(p => (
                <li key={p.pseudonym} className="grid gap-2 px-3 py-2.5 text-sm md:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)]">
                  <span className="font-mono text-xs text-muted-foreground">{p.pseudonym}</span>
                  <span><span className="block text-xs text-muted-foreground">Before</span>{p.before}</span>
                  <span><span className="block text-xs text-muted-foreground">After</span>{p.after}</span>
                </li>
              ))}
              {shown.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">No answers match.</li>}
            </ul>
          </section>
        )
      })}
      {afterOnly.map(group => {
        const shown = group.answers.filter(a => hit(a.text))
        return (
          <section key={group.text} className="space-y-2">
            <h3 className="text-sm font-medium">{group.text} <span className="font-normal text-muted-foreground">· after the event, {shown.length} answers</span></h3>
            <ul className="divide-y rounded-lg border">
              {shown.slice(0, limit).map((a, i) => (
                <li key={`${a.pseudonym}-${i}`} className="grid gap-2 px-3 py-2.5 text-sm md:grid-cols-[5rem_minmax(0,1fr)]">
                  <span className="font-mono text-xs text-muted-foreground">{a.pseudonym}</span>
                  <span>{a.text}</span>
                </li>
              ))}
              {shown.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">No answers match.</li>}
            </ul>
          </section>
        )
      })}
      {[...pairs.map(p => p.pairs.length), ...afterOnly.map(a => a.answers.length)].some(n => n > limit) && (
        <button type="button" onClick={() => setLimit(l => l + 40)} className="cursor-pointer text-sm underline underline-offset-4">Show more</button>
      )}
    </div>
  )
}
