// Server only. Sends survey emails over SMTP (Infomaniak) and records every attempt in
// survey_email_log. Plain helpers that take a client: the Send tab's actions, the submit
// action (thank-you email) and the cron route (/api/surveys/cron) all call these.
//
// Limits: the mailbox may send SURVEYS_EMAIL_DAILY_LIMIT emails per rolling 24 h
// (Infomaniak counts every recipient), and one call sends at most PER_RUN so it finishes
// inside the function time limit; whatever is left waits for the next cron run. Each job
// remembers who it has emailed (job_id in the log), so a run never emails anyone twice.
import nodemailer, { type Transporter } from 'nodemailer'
import type { SupabaseClient } from '@supabase/supabase-js'
import { must } from '@/lib/supabase/must'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { EMAIL_RULES, ruleTime, stageOfKind, wantsEmail, windowOpen } from '@/lib/data/survey-email-rules'
import type { EmailKind, EmailLogStatus, SubmissionStage, SurveyEventRow } from '@/lib/data/surveys.types'
import { participantToken } from '../tokens'
import { surveyLink, surveysBaseUrl } from '../base-url'
import { EMAIL_NOT_SET_UP, emailConfig, type EmailConfig } from './config'
import { renderSurveyEmail, type RenderedEmail } from './templates'

export const PER_RUN = 50
// Example domains (the demo data, tests) are never sent to
const UNDELIVERABLE = /@([a-z0-9-]+\.)*(example\.(org|com|net)|[a-z0-9-]+\.(test|invalid|example))$/

type SurveyForEmail = Pick<SurveyEventRow, 'id' | 'slug' | 'title' | 'status' | 'pre_opens_at' | 'pre_closes_at' | 'post_opens_at' | 'post_closes_at'>
const SURVEY_FIELDS = 'id,slug,title,status,pre_opens_at,pre_closes_at,post_opens_at,post_closes_at'

let transporter: Transporter | null = null
function transport(cfg: EmailConfig): Transporter {
  transporter ??= nodemailer.createTransport({
    host:       cfg.host,
    port:       cfg.port,
    secure:     cfg.port === 465,   // 465: TLS from the start; 587: STARTTLS, required
    requireTLS: cfg.port !== 465,
    auth:       { user: cfg.user, pass: cfg.pass },
    pool:       true,
    maxConnections: 1,
  })
  return transporter
}

async function loadSurvey(db: SupabaseClient, surveyId: string): Promise<SurveyForEmail> {
  const survey = must('survey query', await db.from('survey_events').select(SURVEY_FIELDS).eq('id', surveyId).maybeSingle()) as SurveyForEmail | null
  if (!survey) throw new Error(`survey ${surveyId} not found`)
  return survey
}

export async function emailBudget(db: SupabaseClient, cfg: EmailConfig): Promise<{ limit: number; used: number; remaining: number }> {
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString()
  const used = await db.from('survey_email_log').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('sent_at', since)
  if (used.error) throw new Error(`email budget query failed: ${used.error.message}`)
  const count = used.count ?? 0
  return { limit: cfg.dailyLimit, used: count, remaining: Math.max(0, cfg.dailyLimit - count) }
}

interface Recipient { participantId: string; email: string }

// Who should get this kind of email now, minus anyone this job has already handled
export async function recipientsFor(db: SupabaseClient, surveyId: string, kind: EmailKind, jobId: string | null): Promise<Recipient[]> {
  const participants = await fetchAllRows('email participants query', (from, to) => db
    .from('survey_event_participants').select('id,reminders_off_at,survey_people(email)')
    .eq('survey_event_id', surveyId).order('id').range(from, to)) as unknown as { id: string; reminders_off_at: string | null; survey_people: { email: string | null } | null }[]
  const accepted = await fetchAllRows<{ event_participant_id: string; stage: SubmissionStage }>('email submissions query', (from, to) => db
    .from('survey_submissions').select('event_participant_id,stage,survey_event_participants!inner(survey_event_id)')
    .eq('survey_event_participants.survey_event_id', surveyId).eq('status', 'accepted').order('id').range(from, to))
  const handled = new Set<string>()
  if (jobId) {
    const logged = await fetchAllRows<{ event_participant_id: string }>('job log query', (from, to) => db
      .from('survey_email_log').select('event_participant_id').eq('job_id', jobId).order('id').range(from, to))
    for (const l of logged) handled.add(l.event_participant_id)
  }

  const answered = new Map<string, { pre: boolean; post: boolean }>()
  for (const s of accepted) {
    const a = answered.get(s.event_participant_id) ?? { pre: false, post: false }
    a[s.stage] = true
    answered.set(s.event_participant_id, a)
  }
  return participants
    .filter(p => p.survey_people?.email && !handled.has(p.id)
      && wantsEmail(kind, answered.get(p.id) ?? { pre: false, post: false }, p.reminders_off_at !== null))
    .map(p => ({ participantId: p.id, email: p.survey_people!.email! }))
}

async function logEmail(db: SupabaseClient, participantId: string, kind: EmailKind, jobId: string | null, status: EmailLogStatus, error: string | null) {
  must('email log insert', await db.from('survey_email_log').insert({ job_id: jobId, event_participant_id: participantId, kind, status, error }))
}

function compose(survey: SurveyForEmail, kind: EmailKind, base: string, participantId: string, logoUrl: string | null): RenderedEmail & { stopUrl: string | null } {
  const token = participantToken(participantId)
  const stage: SubmissionStage = kind === 'confirmation' ? 'post' : stageOfKind(kind)
  const stopUrl = kind === 'confirmation' ? null : `${base}/s/${survey.slug}/stop?t=${token}`
  const rendered = renderSurveyEmail({
    kind,
    surveyTitle: survey.title,
    link:        surveyLink(base, survey.slug, stage, token),
    opensAt:     stage === 'pre' ? survey.pre_opens_at : survey.post_opens_at,
    closesAt:    stage === 'pre' ? survey.pre_closes_at : survey.post_closes_at,
    stopUrl,
    logoUrl,
  })
  return { ...rendered, stopUrl }
}

// One email to one participant, logged either way. An SMTP rejection of the address (5xx)
// is logged as bounced; anything else as failed.
async function deliver(db: SupabaseClient, cfg: EmailConfig, base: string, survey: SurveyForEmail, kind: EmailKind, r: Recipient, jobId: string | null): Promise<EmailLogStatus> {
  if (UNDELIVERABLE.test(r.email)) {
    await logEmail(db, r.participantId, kind, jobId, 'failed', 'Example address (demo or test data): not sent')
    return 'failed'
  }
  const email = compose(survey, kind, base, r.participantId, cfg.logoUrl)
  try {
    await transport(cfg).sendMail({
      from:    cfg.from,
      replyTo: cfg.replyTo ?? undefined,
      to:      r.email,
      subject: email.subject,
      html:    email.html,
      text:    email.text,
      headers: email.stopUrl ? { 'List-Unsubscribe': `<${email.stopUrl}>` } : undefined,
    })
    await logEmail(db, r.participantId, kind, jobId, 'sent', null)
    return 'sent'
  } catch (err) {
    const code = (err as { responseCode?: number }).responseCode
    const status: EmailLogStatus = code !== undefined && code >= 550 && code < 560 ? 'bounced' : 'failed'
    await logEmail(db, r.participantId, kind, jobId, status, err instanceof Error ? err.message.slice(0, 500) : String(err))
    return status
  }
}

export interface SendResult {
  sent:    number
  failed:  number
  waiting: number          // still to send: next run, or once the daily limit frees up
  reason:  string | null   // why some are waiting
}

export async function sendSurveyEmails(db: SupabaseClient, { surveyId, kind, jobId, cap = PER_RUN }: { surveyId: string; kind: EmailKind; jobId: string | null; cap?: number }): Promise<SendResult> {
  const cfg = emailConfig()
  const recipients = await recipientsFor(db, surveyId, kind, jobId)
  if (!cfg) return { sent: 0, failed: 0, waiting: recipients.length, reason: EMAIL_NOT_SET_UP }

  const [survey, budget, base] = await Promise.all([loadSurvey(db, surveyId), emailBudget(db, cfg), surveysBaseUrl()])
  const batch = recipients.slice(0, Math.min(cap, budget.remaining))
  let sent = 0, failed = 0
  for (const r of batch) {
    if (await deliver(db, cfg, base, survey, kind, r, jobId) === 'sent') sent++
    else failed++
  }
  const waiting = recipients.length - batch.length
  const reason = waiting === 0 ? null
    : budget.remaining <= cap ? `Daily limit reached (${budget.limit} emails per 24 h); the rest go as the limit frees up`
    : 'The rest go on the next run (every 10 minutes)'
  return { sent, failed, waiting, reason }
}

// The thank-you with the after-survey link, right after a before-survey answered by QR
export async function sendConfirmation(db: SupabaseClient, participantId: string): Promise<boolean> {
  const row = must('participant query', await db.from('survey_event_participants')
    .select('id,survey_event_id,survey_people(email)').eq('id', participantId).maybeSingle()) as unknown as
    { id: string; survey_event_id: string; survey_people: { email: string | null } | null } | null
  const email = row?.survey_people?.email
  if (!row || !email) return false

  const cfg = emailConfig()
  if (!cfg) {
    await logEmail(db, participantId, 'confirmation', null, 'failed', EMAIL_NOT_SET_UP)
    return false
  }
  if ((await emailBudget(db, cfg)).remaining <= 0) {
    await logEmail(db, participantId, 'confirmation', null, 'failed', 'Daily email limit reached')
    return false
  }
  const [survey, base] = await Promise.all([loadSurvey(db, row.survey_event_id), surveysBaseUrl()])
  return await deliver(db, cfg, base, survey, 'confirmation', { participantId, email }, null) === 'sent'
}

// A sample of one kind to an admin's own address, to check the look and deliverability.
// Not logged against any participant.
export async function sendTestEmail(db: SupabaseClient, surveyId: string, kind: EmailKind, to: string): Promise<void> {
  const cfg = emailConfig()
  if (!cfg) throw new Error(EMAIL_NOT_SET_UP)
  const [survey, base] = await Promise.all([loadSurvey(db, surveyId), surveysBaseUrl()])
  const stage: SubmissionStage = kind === 'confirmation' ? 'post' : stageOfKind(kind)
  const email = renderSurveyEmail({
    kind,
    surveyTitle: survey.title,
    link:        surveyLink(base, survey.slug, stage),
    opensAt:     stage === 'pre' ? survey.pre_opens_at : survey.post_opens_at,
    closesAt:    stage === 'pre' ? survey.pre_closes_at : survey.post_closes_at,
    stopUrl:     kind === 'confirmation' ? null : `${base}/s/${survey.slug}/stop`,
    logoUrl:     cfg.logoUrl,
  })
  await transport(cfg).sendMail({ from: cfg.from, replyTo: cfg.replyTo ?? undefined, to, subject: `[Test] ${email.subject}`, html: email.html, text: email.text })
}

// ─── Scheduled jobs ───────────────────────────────────────────────────────────

// One job per rule for an active survey; times follow the windows while still scheduled
export async function syncJobs(db: SupabaseClient, surveyId: string): Promise<void> {
  const survey = await loadSurvey(db, surveyId)
  if (survey.status !== 'active') return
  const existing = must('jobs query', await db.from('survey_email_jobs')
    .select('id,rule,status').eq('survey_event_id', surveyId).not('rule', 'is', null)) as { id: string; rule: string; status: string }[]
  for (const rule of EMAIL_RULES) {
    const at = ruleTime(rule, survey)
    const job = existing.find(j => j.rule === rule.rule)
    if (!job) {
      if (at) must('job insert', await db.from('survey_email_jobs').insert({ survey_event_id: surveyId, kind: rule.kind, rule: rule.rule, scheduled_at: at }))
    } else if (job.status === 'scheduled') {
      must('job update', await db.from('survey_email_jobs').update(at ? { scheduled_at: at } : { status: 'cancelled' }).eq('id', job.id))
    }
  }
}

export interface RunSummary {
  jobs:   number
  sent:   number
  failed: number
  notes:  string[]
}

// Sends what's due: called every 10 minutes by pg_cron through /api/surveys/cron
export async function runDueJobs(db: SupabaseClient, now = Date.now()): Promise<RunSummary> {
  const due = must('due jobs query', await db.from('survey_email_jobs')
    .select('id,kind,survey_event_id,status')
    .in('status', ['scheduled', 'sending']).lte('scheduled_at', new Date(now).toISOString())
    .order('scheduled_at')) as { id: string; kind: EmailKind; survey_event_id: string; status: string }[]

  const summary: RunSummary = { jobs: 0, sent: 0, failed: 0, notes: [] }
  let left = PER_RUN
  for (const job of due) {
    if (left <= 0) break
    const survey = await loadSurvey(db, job.survey_event_id)
    if (survey.status === 'closed') {
      must('job cancel', await db.from('survey_email_jobs').update({ status: 'cancelled' }).eq('id', job.id))
      continue
    }
    if (survey.status !== 'active') continue
    if (!windowOpen(stageOfKind(job.kind), survey, now)) {
      // Its survey window has passed: nothing left to do
      must('job finish', await db.from('survey_email_jobs').update({ status: 'done' }).eq('id', job.id))
      continue
    }
    must('job start', await db.from('survey_email_jobs').update({ status: 'sending' }).eq('id', job.id))
    const result = await sendSurveyEmails(db, { surveyId: survey.id, kind: job.kind, jobId: job.id, cap: left })
    summary.jobs++
    summary.sent += result.sent
    summary.failed += result.failed
    left -= result.sent + result.failed
    if (result.waiting === 0) must('job finish', await db.from('survey_email_jobs').update({ status: 'done' }).eq('id', job.id))
    if (result.reason) { summary.notes.push(`${survey.slug} ${job.kind}: ${result.reason}`); if (result.reason === EMAIL_NOT_SET_UP || result.reason.startsWith('Daily limit')) break }
  }
  return summary
}

// "Send now" on the Send tab: a one-off job, sent straight away as far as the limits allow
export async function sendNow(db: SupabaseClient, surveyId: string, kind: EmailKind): Promise<SendResult & { jobId: string }> {
  const job = must('job insert', await db.from('survey_email_jobs')
    .insert({ survey_event_id: surveyId, kind, rule: null, scheduled_at: new Date().toISOString(), status: 'sending' })
    .select('id').single()) as { id: string }
  const result = await sendSurveyEmails(db, { surveyId, kind, jobId: job.id })
  if (result.waiting === 0) must('job finish', await db.from('survey_email_jobs').update({ status: 'done' }).eq('id', job.id))
  return { ...result, jobId: job.id }
}
