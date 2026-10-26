'use client'

// Send tab: is email working, send invites now, the scheduled emails (on/off), a test to
// yourself, and the log of every email sent.
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Check, Mail, Send, X } from 'lucide-react'
import StatusBadge from '@/components/base/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import LocalDateTime from '@/components/surveys/LocalDateTime'
import { EMAIL_KIND_LABELS } from '@/lib/data/survey-participants'
import { EMAIL_KINDS, type EmailKind, type SurveyStatus } from '@/lib/data/surveys.types'
import type { JobView, SendOverview } from '@/lib/surveys/email/overview'
import { cn } from '@/lib/utils'
import { sendInvitesNow, sendTestToMe, setRuleEnabled } from '../../send-actions'

const KIND_ITEMS = Object.fromEntries(EMAIL_KINDS.map(k => [k, EMAIL_KIND_LABELS[k]]))

function jobState(job: JobView | null, at: string | null, status: SurveyStatus): string {
  if (!at) return 'Doesn\'t fit inside the survey window'
  if (!job) return status === 'draft' ? 'Set up when you open the survey' : 'Not scheduled'
  if (job.status === 'cancelled') return 'Off'
  if (job.status === 'done') return `Sent to ${job.sent}${job.failed ? `, ${job.failed} failed` : ''}`
  if (job.status === 'sending') return `Sending: ${job.sent} so far`
  return 'Scheduled'
}

function Switch({ on, disabled, label, onChange }: { on: boolean; disabled: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={cn(
        'relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default disabled:opacity-50',
        on ? 'bg-primary' : 'bg-muted-foreground/30',
      )}
    >
      <span className={cn('absolute top-0.5 size-4 rounded-full bg-background transition-all', on ? 'left-[18px]' : 'left-0.5')} />
    </button>
  )
}

export default function SendTab({ surveyId, status, overview }: { surveyId: string; status: SurveyStatus; overview: SendOverview }) {
  const [testKind, setTestKind] = useState<EmailKind>('invite_pre')
  const [pending, startTransition] = useTransition()
  const ready = overview.configured && !overview.needsMigration

  function run<T>(action: () => Promise<{ ok: true } & T | { ok: false; error: string }>, done: (r: T) => void) {
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) { toast.error(result.error); return }
        done(result)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  function sendNow(kind: 'invite_pre' | 'invite_post') {
    run(() => sendInvitesNow(surveyId, kind), ({ result }) => {
      toast.success(`${result.sent} sent${result.failed ? `, ${result.failed} failed` : ''}`, { description: result.reason ?? undefined })
    })
  }

  return (
    <div className="space-y-6">
      {!overview.configured && (
        <div className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <span>
            Email sending isn&apos;t set up yet. Add <code>SURVEYS_SMTP_HOST</code>, <code>SURVEYS_SMTP_PORT</code>,{' '}
            <code>SURVEYS_SMTP_USER</code>, <code>SURVEYS_SMTP_PASS</code> and <code>SURVEYS_EMAIL_FROM</code> (Infomaniak mailbox)
            to the env vars. Until then, nothing is sent and the thank-you emails are logged as failed.
          </span>
        </div>
      )}
      {overview.needsMigration && (
        <div className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <span>Run <code>supabase/migrations/20261026_survey_email.sql</code> in the SQL editor first (it adds &quot;stop reminders&quot;).</span>
        </div>
      )}
      {overview.configured && overview.budget && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Mail className="size-4" aria-hidden="true" /> From {overview.from}{overview.replyTo && `, replies to ${overview.replyTo}`}</span>
          <span>{overview.budget.used} of {overview.budget.limit} emails sent in the last 24 h (all surveys)</span>
        </p>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Send now</CardTitle>
            <CardDescription>Each person gets their own link. Only people who haven&apos;t answered that survey yet are emailed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {([['invite_pre', 'Before-survey invite', overview.open.pre], ['invite_post', 'After-survey invite', overview.open.post]] as const).map(([kind, label, open]) => (
              <div key={kind} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                <span className="text-sm">
                  <span className="block font-medium">{label}</span>
                  <span className="text-muted-foreground">
                    {status !== 'active' ? 'Open the survey first' : !open ? `The ${kind === 'invite_pre' ? 'before' : 'after'}-survey isn't open now` : `${overview.reach[kind]} people haven't answered`}
                  </span>
                </span>
                <Button size="sm" disabled={!ready || status !== 'active' || !open || overview.reach[kind] === 0 || pending} onClick={() => sendNow(kind)}>
                  <Send data-icon="inline-start" aria-hidden="true" />
                  Send
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scheduled emails</CardTitle>
            <CardDescription>Sent automatically at these times (checked every 10 minutes), within the mailbox&apos;s daily limit.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {overview.rules.map(r => {
                const on = r.job ? r.job.status !== 'cancelled' : false
                return (
                  <li key={r.rule} className="flex items-center gap-3 py-2.5 first:pt-0">
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block font-medium">{r.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {r.at && <><LocalDateTime iso={r.at} /> · </>}{jobState(r.job, r.at, status)} · {r.audience}
                      </span>
                    </span>
                    <Switch
                      on={on}
                      label={r.label}
                      disabled={!r.job || r.job.status === 'done' || pending}
                      onChange={next => run(() => setRuleEnabled(surveyId, r.rule, next), () => toast.success(next ? 'Switched on' : 'Switched off'))}
                    />
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Send yourself a test</CardTitle>
          <CardDescription>See how an email looks in your inbox and check it doesn&apos;t land in spam. The link in it asks for an email.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Select value={testKind} onValueChange={v => { if (v) setTestKind(v as EmailKind) }} items={KIND_ITEMS}>
            <SelectTrigger className="w-64" aria-label="Which email"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EMAIL_KINDS.map(k => <SelectItem key={k} value={k}>{EMAIL_KIND_LABELS[k]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" disabled={!overview.configured || pending}
            onClick={() => run(() => sendTestToMe(surveyId, testKind), ({ to }) => toast.success(`Test sent to ${to}`))}>
            Send me a test
          </Button>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="py-4">
          <CardTitle>Email log</CardTitle>
          <CardDescription>The latest 100 emails of this survey.</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="pl-4">When</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>To</TableHead>
              <TableHead className="pr-4">Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overview.log.length === 0 && (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No emails yet.</TableCell></TableRow>
            )}
            {overview.log.map(l => (
              <TableRow key={l.id}>
                <TableCell className="pl-4 text-sm whitespace-nowrap text-muted-foreground"><LocalDateTime iso={l.sentAt} /></TableCell>
                <TableCell className="text-sm">{EMAIL_KIND_LABELS[l.kind]}</TableCell>
                <TableCell className="font-mono text-[13px]">{l.email ?? '—'}</TableCell>
                <TableCell className="pr-4">
                  {l.status === 'sent'
                    ? <StatusBadge tone="success" icon={Check}>Sent</StatusBadge>
                    : <span className="flex flex-col items-start gap-1">
                        <StatusBadge tone="danger" icon={X}>{l.status === 'bounced' ? 'Bounced' : 'Failed'}</StatusBadge>
                        {l.error && <span className="max-w-md text-xs text-muted-foreground">{l.error}</span>}
                      </span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
