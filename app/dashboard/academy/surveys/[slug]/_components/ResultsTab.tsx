import { Info } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getSurveyResults } from '@/lib/data/surveys'
import { showCount } from '@/lib/data/survey-results'
import { formatRate } from '@/lib/data/survey-progress'
import type { SurveyProgress } from '@/lib/data/surveys.types'
import { BarList, Dumbbell, DumbbellLegend, fmt, pct, signed } from './ResultsCharts'
import { BreakdownTable, Quotes, ShiftChart } from './ResultsInteractive'

// Results tab: anonymised, pseudonyms only. Before/after comparisons use matched people
// (answered both); breakdown groups under 5 are hidden.
export default async function ResultsTab({ surveyId, progress }: { surveyId: string; progress: SurveyProgress }) {
  const r = await getSurveyResults(surveyId)
  const comparable = r.scales.filter(s => s.n > 0)

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          {r.matched} people answered both surveys ({formatRate(progress.matchRate)} of the {progress.pre} who answered before).
          Before/after comparisons use only them. These are what participants reported, not proof that the event caused a change.
        </span>
      </p>

      {comparable.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nobody has answered both surveys yet, so there is nothing to compare.</CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Before and after</CardTitle>
              <CardDescription>Average answer on each 1–5 question, before the event and after it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <DumbbellLegend />
              <Dumbbell scales={comparable} />
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">Show as a table</summary>
                <Table className="mt-2">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Question</TableHead>
                      <TableHead className="text-right">People</TableHead>
                      <TableHead className="text-right">Before</TableHead>
                      <TableHead className="text-right">After</TableHead>
                      <TableHead className="text-right">Change</TableHead>
                      <TableHead className="text-right">Higher / same / lower</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparable.map(s => (
                      <TableRow key={s.versionId}>
                        <TableCell className="whitespace-normal">{s.text}</TableCell>
                        <TableCell className="text-right tabular-nums">{s.n}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(s.before)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(s.after)}</TableCell>
                        <TableCell className="text-right tabular-nums">{signed(s.after! - s.before!)}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(s.higher, s.n)}% / {pct(s.same, s.n)}% / {pct(s.lower, s.n)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </details>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How answers shifted</CardTitle>
              <CardDescription>The share of people giving each answer, before and after.</CardDescription>
            </CardHeader>
            <CardContent><ShiftChart scales={comparable} /></CardContent>
          </Card>
        </>
      )}

      {(r.afterScales.length > 0 || r.afterChoices.length > 0) && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          {r.afterScales.map(s => (
            <Card key={s.versionId}>
              <CardHeader>
                <CardTitle>{s.text}</CardTitle>
                <CardDescription>Asked after the event · {s.n} answers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p><span className="text-3xl font-semibold">{fmt(s.mean)}</span><span className="text-sm text-muted-foreground"> out of 5 on average</span></p>
                <BarList items={[5, 4, 3, 2, 1].map(k => ({ label: String(k), count: s.dist[k - 1] }))} total={s.n} />
              </CardContent>
            </Card>
          ))}
          {r.afterChoices.map(c => (
            <Card key={c.versionId}>
              <CardHeader>
                <CardTitle>{c.text}</CardTitle>
                <CardDescription>Asked after the event · {c.n} answers</CardDescription>
              </CardHeader>
              <CardContent><BarList items={c.options.map((o, i) => ({ label: o, count: c.counts[i] }))} total={c.n} /></CardContent>
            </Card>
          ))}
        </div>
      )}

      {r.choices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Other questions asked before and after</CardTitle>
            <CardDescription>Share of people who answered both, per choice.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {r.choices.map(c => (
              <div key={c.versionId} className="space-y-2">
                <p className="text-sm font-medium">{c.text} <span className="font-normal text-muted-foreground">· {c.n} people</span></p>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Choice</TableHead><TableHead className="text-right">Before</TableHead><TableHead className="text-right">After</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {c.options.map((o, i) => (
                      <TableRow key={o}>
                        <TableCell>{o}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(c.before[i], c.n)}%</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(c.after[i], c.n)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {comparable.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>By career stage and region</CardTitle>
            <CardDescription>Average before and after for each group. Groups with fewer than 5 people are hidden.</CardDescription>
          </CardHeader>
          <CardContent><BreakdownTable scales={comparable} breakdowns={r.breakdowns} /></CardContent>
        </Card>
      )}

      {r.who.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Who answered</CardTitle>
            <CardDescription>From the before-survey. Counts under 5 are shown as &quot;fewer than 5&quot;.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            {r.who.map(w => (
              <Table key={w.versionId}>
                <TableHeader>
                  <TableRow><TableHead>{w.text}</TableHead><TableHead className="text-right">People</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {w.options.map((o, i) => (
                    <TableRow key={o}>
                      <TableCell className="whitespace-normal">{o}</TableCell>
                      <TableCell className="text-right tabular-nums">{showCount(w.counts[i])}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ))}
          </CardContent>
        </Card>
      )}

      {(r.textPairs.some(t => t.pairs.length > 0) || r.afterTexts.some(t => t.answers.length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle>In their own words</CardTitle>
            <CardDescription>Shown by pseudonym (like P-7F3K), never by name or email.</CardDescription>
          </CardHeader>
          <CardContent>
            <Quotes pairs={r.textPairs} afterOnly={r.afterTexts} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
