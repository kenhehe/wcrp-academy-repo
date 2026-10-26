// Server only. What the Send tab shows for one survey: is email set up, how much of the
// daily limit is left, the timing rules and their jobs, who "Send now" would reach, and the
// email log (addresses and outcomes only, never answers).
import { cache } from 'react'
import { requireAcademyAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { must } from '@/lib/supabase/must'
import { EMAIL_RULES, ruleTime, windowOpen } from '@/lib/data/survey-email-rules'
import type { EmailJobStatus, EmailKind, EmailLogStatus, SurveyEventRow } from '@/lib/data/surveys.types'
import { emailConfig } from './config'
import { emailBudget, recipientsFor } from './send'

export interface JobView {
  id:          string
  kind:        EmailKind
  rule:        string | null
  status:      EmailJobStatus
  scheduledAt: string
  sent:        number
  failed:      number
}

export interface SendOverview {
  configured:     boolean
  from:           string | null
  replyTo:        string | null
  budget:         { limit: number; used: number; remaining: number } | null
  needsMigration: boolean   // 20261026_survey_email.sql not applied yet
  rules:          { rule: string; kind: EmailKind; label: string; audience: string; at: string | null; job: JobView | null }[]
  oneOffs:        JobView[]   // "Send now" jobs
  reach:          { invite_pre: number; invite_post: number }
  open:           { pre: boolean; post: boolean }
  log:            { id: string; email: string | null; kind: EmailKind; status: EmailLogStatus; error: string | null; sentAt: string }[]
}

export const getSendOverview = cache(async (survey: SurveyEventRow): Promise<SendOverview> => {
  await requireAcademyAdmin()
  const db = createAdminClient()
  const cfg = emailConfig()

  const column = await db.from('survey_event_participants').select('reminders_off_at').limit(1)
  const needsMigration = column.error?.code === '42703'
  if (column.error && !needsMigration) throw new Error(`reminders column check failed: ${column.error.message}`)

  const jobs = must('jobs query', await db.from('survey_email_jobs')
    .select('id,kind,rule,status,scheduled_at').eq('survey_event_id', survey.id).order('scheduled_at')) as
    { id: string; kind: EmailKind; rule: string | null; status: EmailJobStatus; scheduled_at: string }[]
  const log = await fetchAllRows('email log query', (from, to) => db.from('survey_email_log')
    .select('id,job_id,kind,status,error,sent_at,survey_event_participants!inner(survey_event_id,survey_people(email))')
    .eq('survey_event_participants.survey_event_id', survey.id)
    .order('sent_at', { ascending: false }).order('id').range(from, to)) as unknown as
    { id: string; job_id: string | null; kind: EmailKind; status: EmailLogStatus; error: string | null; sent_at: string; survey_event_participants: { survey_people: { email: string | null } | null } }[]

  const counts = new Map<string, { sent: number; failed: number }>()
  for (const l of log) {
    if (!l.job_id) continue
    const c = counts.get(l.job_id) ?? { sent: 0, failed: 0 }
    if (l.status === 'sent') c.sent++
    else c.failed++
    counts.set(l.job_id, c)
  }
  const view = (j: (typeof jobs)[number]): JobView => ({
    id: j.id, kind: j.kind, rule: j.rule, status: j.status, scheduledAt: j.scheduled_at,
    sent: counts.get(j.id)?.sent ?? 0, failed: counts.get(j.id)?.failed ?? 0,
  })

  const now = Date.now()
  const [budget, preReach, postReach] = await Promise.all([
    cfg ? emailBudget(db, cfg) : Promise.resolve(null),
    needsMigration ? Promise.resolve([]) : recipientsFor(db, survey.id, 'invite_pre', null),
    needsMigration ? Promise.resolve([]) : recipientsFor(db, survey.id, 'invite_post', null),
  ])

  return {
    configured: cfg !== null,
    from:       cfg?.from ?? null,
    replyTo:    cfg?.replyTo ?? null,
    budget,
    needsMigration,
    rules: EMAIL_RULES.map(r => {
      const job = jobs.find(j => j.rule === r.rule)
      return { rule: r.rule, kind: r.kind, label: r.label, audience: r.audience, at: job?.scheduled_at ?? ruleTime(r, survey), job: job ? view(job) : null }
    }),
    oneOffs: jobs.filter(j => j.rule === null).map(view).reverse(),
    reach:   { invite_pre: preReach.length, invite_post: postReach.length },
    open:    { pre: windowOpen('pre', survey, now), post: windowOpen('post', survey, now) },
    log: log.slice(0, 100).map(l => ({
      id: l.id, kind: l.kind, status: l.status, error: l.error, sentAt: l.sent_at,
      email: l.survey_event_participants.survey_people?.email ?? null,
    })),
  }
})
