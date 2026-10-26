'use client'

// Participants tab: import addresses (paste or CSV), see where each person is, copy their
// personal link, remove or merge. Emails and statuses only; answers never appear here.
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Check, CircleDashed, Copy, Flag, Footprints, Link2, Mail, Merge, Search, Trash2, Upload } from 'lucide-react'
import StatusBadge from '@/components/base/StatusBadge'
import type { StatusTone } from '@/components/base/StatusBadge/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import LocalDateTime from '@/components/surveys/LocalDateTime'
import {
  PARTICIPANT_STATE_LABELS, emailsFromCsv, splitEmailList,
  type ParticipantListItem, type ParticipantState,
} from '@/lib/data/survey-participants'
import type { SubmissionStage, SurveyStatus } from '@/lib/data/surveys.types'
import { cn } from '@/lib/utils'
import type { ImportSummary } from '@/lib/surveys/participants'
import { importParticipants, mergeParticipants, participantLink, removeParticipant } from '../../participant-actions'

const PAGE = 50

const STATE_LOOK: Record<ParticipantState, { tone: StatusTone; icon: typeof Check }> = {
  not_started: { tone: 'neutral', icon: CircleDashed },
  invited:     { tone: 'neutral', icon: Mail },
  before_only: { tone: 'info',    icon: CircleDashed },
  after_only:  { tone: 'warning', icon: AlertTriangle },
  matched:     { tone: 'success', icon: Check },
}

type Filter = 'all' | ParticipantState | 'walk_in' | 'flagged' | 'bounced'

const matches = (p: ParticipantListItem, f: Filter) =>
  f === 'all' ? true
  : f === 'walk_in' ? p.status.walkIn
  : f === 'flagged' ? p.status.flagged > 0
  : f === 'bounced' ? p.status.bounced
  : p.status.state === f

interface Props {
  surveyId:     string
  surveyStatus: SurveyStatus
  participants: ParticipantListItem[]
}

function ImportCard({ surveyId, closed }: { surveyId: string; closed: boolean }) {
  const [text, setText] = useState('')
  const [fileEntries, setFileEntries] = useState<{ name: string; entries: string[] } | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [pending, startTransition] = useTransition()

  const entries = [...splitEmailList(text), ...(fileEntries?.entries ?? [])]

  async function readFile(file: File | undefined) {
    if (!file) return
    const content = await file.text()
    setFileEntries({ name: file.name, entries: emailsFromCsv(content) })
  }

  function handleImport() {
    startTransition(async () => {
      try {
        const result = await importParticipants(surveyId, entries)
        if (!result.ok) { toast.error(result.error); return }
        setSummary(result.summary)
        setText('')
        setFileEntries(null)
        toast.success(`${result.summary.added} added`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not import the list')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add participants</CardTitle>
        <CardDescription>
          Paste addresses (one per line, or separated by commas) or upload a CSV such as a Zoom registration export.
          Repeats are skipped; people already in the survey stay as they are.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
          placeholder={'a.mensah@example.org\nl.okafor@example.edu, p.silva@example.org'}
          aria-label="Email addresses"
          disabled={closed}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-normal hover:bg-muted/50">
            <Upload className="size-4" aria-hidden="true" />
            {fileEntries ? `${fileEntries.name}: ${fileEntries.entries.length} addresses` : 'Upload CSV'}
            <input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" disabled={closed}
              onChange={e => { void readFile(e.target.files?.[0]); e.target.value = '' }} />
          </Label>
          <span className="text-sm text-muted-foreground">{entries.length} to import</span>
          <Button className="ml-auto" disabled={closed || entries.length === 0 || pending} onClick={handleImport}>
            {pending ? 'Importing…' : 'Import'}
          </Button>
        </div>
        {closed && <p className="text-sm text-muted-foreground">This survey is closed, so nobody new can join.</p>}
        {summary && (
          <div role="status" className="space-y-1 rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
            <p>
              <strong>{summary.added}</strong> added · {summary.already} already in the survey
              {summary.repeated > 0 && ` · ${summary.repeated} repeats skipped`}
              {summary.invalid.length > 0 && ` · ${summary.invalid.length} not email addresses`}
            </p>
            {summary.invalid.length > 0 && (
              <p className="text-muted-foreground">
                Not imported: {summary.invalid.slice(0, 10).join(', ')}{summary.invalid.length > 10 && ` and ${summary.invalid.length - 10} more`}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function ParticipantsTab({ surveyId, surveyStatus, participants }: Props) {
  const [filter, setFilter]     = useState<Filter>('all')
  const [query, setQuery]       = useState('')
  const [page, setPage]         = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [merging, setMerging]   = useState<{ keep: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const counts = useMemo(() => {
    const c = {} as Record<Filter, number>
    for (const f of ['all', 'not_started', 'invited', 'before_only', 'after_only', 'matched', 'walk_in', 'flagged', 'bounced'] as Filter[]) {
      c[f] = participants.filter(p => matches(p, f)).length
    }
    return c
  }, [participants])

  const q = query.trim().toLowerCase()
  const shown = participants.filter(p => matches(p, filter) && (!q || (p.email ?? '').includes(q)))
  const pages = Math.max(1, Math.ceil(shown.length / PAGE))
  const current = Math.min(page, pages)
  const rows = shown.slice((current - 1) * PAGE, current * PAGE)
  const pair = selected.length === 2 ? selected.map(id => participants.find(p => p.id === id)).filter(Boolean) as ParticipantListItem[] : []

  const filters: [Filter, string][] = [
    ['all', 'All'], ['not_started', 'Not started'], ['invited', 'Invited'], ['before_only', 'Answered before'],
    ['matched', 'Matched'], ['after_only', 'After only'], ['walk_in', 'Walk-ins'], ['flagged', 'Flagged'], ['bounced', 'Bounced'],
  ]

  function toggle(id: string, on: boolean) {
    setSelected(list => on ? [...list.filter(x => x !== id), id].slice(-2) : list.filter(x => x !== id))
  }

  function copyLink(p: ParticipantListItem, stage: SubmissionStage) {
    startTransition(async () => {
      try {
        const result = await participantLink(surveyId, p.id, stage)
        if (!result.ok) { toast.error(result.error); return }
        await navigator.clipboard.writeText(result.url)
        toast.success(`${stage === 'pre' ? 'Before' : 'After'}-survey link copied`, { description: 'It is personal: whoever opens it answers as this person.' })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not copy the link')
      }
    })
  }

  function remove(p: ParticipantListItem) {
    startTransition(async () => {
      try {
        const result = await removeParticipant(surveyId, p.id)
        if (!result.ok) { toast.error(result.error); return }
        setSelected(list => list.filter(x => x !== p.id))
        toast.success(`${p.email ?? 'Participant'} removed`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not remove them')
      }
    })
  }

  function merge() {
    if (!merging || pair.length !== 2) return
    const other = pair.find(p => p.id !== merging.keep)!
    startTransition(async () => {
      try {
        const result = await mergeParticipants(surveyId, merging.keep, other.id)
        if (!result.ok) { toast.error(result.error); return }
        setSelected([])
        setMerging(null)
        toast.success('Merged', { description: `${other.email ?? 'The other address'} now counts as the same person.` })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not merge them')
      }
    })
  }

  return (
    <div className="space-y-6">
      <ImportCard surveyId={surveyId} closed={surveyStatus === 'closed'} />

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-4">
          {filters.map(([f, label]) => (
            <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} aria-pressed={filter === f}
              onClick={() => { setFilter(f); setPage(1) }} disabled={f !== 'all' && counts[f] === 0}>
              {label} <span className={cn('tabular-nums', filter !== f && 'text-muted-foreground')}>{counts[f]}</span>
            </Button>
          ))}
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} placeholder="Search by email" aria-label="Search by email" className="pl-8" />
          </div>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b bg-muted/40 px-4 py-2.5 text-sm">
            <span>{selected.length} selected{selected.length === 1 && ': pick one more to merge two addresses of the same person'}</span>
            <Button size="sm" variant="outline" className="ml-auto" disabled={pair.length !== 2} onClick={() => setMerging({ keep: pair[0].id })}>
              <Merge data-icon="inline-start" aria-hidden="true" />
              Merge the two
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Clear</Button>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-10 pl-4"><span className="sr-only">Select</span></TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last activity</TableHead>
              <TableHead className="pr-4 text-right"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className={cn(pending && 'opacity-60')}>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  {participants.length === 0 ? 'Nobody yet. Import the registration list above, or people join by QR code.' : 'Nobody matches.'}
                </TableCell>
              </TableRow>
            )}
            {rows.map(p => {
              const look = STATE_LOOK[p.status.state]
              return (
                <TableRow key={p.id} data-state={selected.includes(p.id) ? 'selected' : undefined}>
                  <TableCell className="pl-4">
                    <Checkbox checked={selected.includes(p.id)} onCheckedChange={v => toggle(p.id, v === true)} aria-label={`Select ${p.email ?? 'participant'}`} />
                  </TableCell>
                  <TableCell className="font-mono text-[13px]">{p.email ?? <span className="text-muted-foreground">deleted after 24 months</span>}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1.5">
                      <StatusBadge tone={look.tone} icon={look.icon}>{PARTICIPANT_STATE_LABELS[p.status.state]}</StatusBadge>
                      {p.status.walkIn && <StatusBadge tone="neutral" icon={Footprints}>Walk-in</StatusBadge>}
                      {p.status.flagged > 0 && <StatusBadge tone="warning" icon={Flag}>Repeat answer</StatusBadge>}
                      {p.status.bounced && <StatusBadge tone="danger" icon={AlertTriangle}>Email failed</StatusBadge>}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.lastActivity ? <>{p.lastActivity.label} · <LocalDateTime iso={p.lastActivity.at} /></> : 'Imported'}
                  </TableCell>
                  <TableCell className="pr-4">
                    <span className="flex justify-end">
                      <Button variant="ghost" size="icon-sm" aria-label={`Copy ${p.email}'s before-survey link`} title="Copy before-survey link" disabled={!p.email} onClick={() => copyLink(p, 'pre')}>
                        <Link2 aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Copy ${p.email}'s after-survey link`} title="Copy after-survey link" disabled={!p.email} onClick={() => copyLink(p, 'post')}>
                        <Copy aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Remove ${p.email}`} title="Remove (only if they haven't answered)" onClick={() => remove(p)}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        {pages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
            <span>{(current - 1) * PAGE + 1}–{Math.min(current * PAGE, shown.length)} of {shown.length}</span>
            <span className="flex gap-2">
              <Button size="sm" variant="outline" disabled={current === 1} onClick={() => setPage(current - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={current === pages} onClick={() => setPage(current + 1)}>Next</Button>
            </span>
          </div>
        )}
      </Card>

      <Dialog open={merging !== null} onOpenChange={open => { if (!open) setMerging(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge two addresses</DialogTitle>
            <DialogDescription>
              Use this when one person answered with two addresses (say, work before and Gmail after). Their answers
              then count as one person. Pick the address to keep.
            </DialogDescription>
          </DialogHeader>
          <div role="radiogroup" className="space-y-2">
            {pair.map(p => (
              <label key={p.id} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5', merging?.keep === p.id && 'border-primary bg-accent')}>
                <input type="radio" name="keep" checked={merging?.keep === p.id} onChange={() => setMerging({ keep: p.id })} className="size-4 accent-primary" />
                <span className="min-w-0">
                  <span className="block font-mono text-[13px]">{p.email}</span>
                  <span className="block text-xs text-muted-foreground">{PARTICIPANT_STATE_LABELS[p.status.state]}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            If both answered the same survey, the kept address&apos;s answers count and the others are flagged as a repeat.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMerging(null)}>Cancel</Button>
            <Button onClick={merge} disabled={pending}>{pending ? 'Merging…' : 'Merge'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
