'use server'

// Send tab: send invites now, switch scheduled emails on or off, send a test to yourself
// (Academy admins only). The sending itself is in lib/surveys/email/send.ts.
import { revalidatePath } from 'next/cache'
import { requireAcademyAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { must } from '@/lib/supabase/must'
import { EMAIL_RULES, windowOpen } from '@/lib/data/survey-email-rules'
import { EMAIL_KINDS, type ActionResult, type EmailKind, type SurveyEventRow } from '@/lib/data/surveys.types'
import { EMAIL_NOT_SET_UP, emailConfig } from '@/lib/surveys/email/config'
import { sendNow, sendTestEmail, type SendResult } from '@/lib/surveys/email/send'

const fail = (error: string) => ({ ok: false as const, error })

async function loadSurvey(surveyId: string) {
  const db = createAdminClient()
  const survey = must('survey query', await db.from('survey_events').select('*').eq('id', surveyId).maybeSingle()) as SurveyEventRow | null
  return { db, survey }
}

export async function sendInvitesNow(surveyId: string, kind: 'invite_pre' | 'invite_post'): Promise<ActionResult<{ result: SendResult }>> {
  const user = await requireAcademyAdmin()
  if (kind !== 'invite_pre' && kind !== 'invite_post') return fail('Unknown email.')
  if (!emailConfig()) return fail(EMAIL_NOT_SET_UP)
  const { db, survey } = await loadSurvey(surveyId)
  if (!survey) return fail('Survey not found.')
  if (survey.status !== 'active') return fail('Open the survey first.')
  if (!windowOpen(kind === 'invite_pre' ? 'pre' : 'post', survey, Date.now())) return fail(`The ${kind === 'invite_pre' ? 'before' : 'after'}-survey isn't open right now.`)

  const result = await sendNow(db, surveyId, kind)
  must('survey admin log insert', await db.from('survey_admin_log').insert({
    actor_id: user.id, action: 'email.send_now', survey_event_id: surveyId,
    detail: { kind, sent: result.sent, failed: result.failed, waiting: result.waiting },
  }))
  revalidatePath('/dashboard/academy/surveys', 'layout')
  return { ok: true, result }
}

// Switch one scheduled email (a rule) on or off. Emails already sent stay sent.
export async function setRuleEnabled(surveyId: string, rule: string, on: boolean): Promise<ActionResult> {
  await requireAcademyAdmin()
  if (!EMAIL_RULES.some(r => r.rule === rule)) return fail('Unknown email rule.')
  const db = createAdminClient()
  const job = must('job query', await db.from('survey_email_jobs')
    .select('id,status').eq('survey_event_id', surveyId).eq('rule', rule).maybeSingle()) as { id: string; status: string } | null
  if (!job) return fail('Scheduled emails are set up when you open the survey.')
  if (job.status === 'done') return fail('This email has already gone out.')

  if (on && job.status === 'cancelled') must('job enable', await db.from('survey_email_jobs').update({ status: 'scheduled' }).eq('id', job.id))
  if (!on && (job.status === 'scheduled' || job.status === 'sending')) must('job disable', await db.from('survey_email_jobs').update({ status: 'cancelled' }).eq('id', job.id))

  revalidatePath('/dashboard/academy/surveys', 'layout')
  return { ok: true }
}

// A sample to the signed-in admin's own address, with a link that asks for an email
export async function sendTestToMe(surveyId: string, kind: EmailKind): Promise<ActionResult<{ to: string }>> {
  const user = await requireAcademyAdmin()
  if (!(EMAIL_KINDS as readonly string[]).includes(kind)) return fail('Unknown email.')
  if (!user.email) return fail('Your account has no email address.')
  if (!emailConfig()) return fail(EMAIL_NOT_SET_UP)
  const db = createAdminClient()
  try {
    await sendTestEmail(db, surveyId, kind, user.email)
  } catch (err) {
    return fail(`The mail server refused it: ${err instanceof Error ? err.message : String(err)}`)
  }
  must('survey admin log insert', await db.from('survey_admin_log').insert({ actor_id: user.id, action: 'email.test', survey_event_id: surveyId, detail: { kind } }))
  return { ok: true, to: user.email }
}
