'use server'

// Participant actions behind /s/[slug]/[stage]. Public: no login, so each call works out who
// is answering from what it can verify (the personal-link token, the signed device cookie,
// or an email just typed) and re-checks the survey's window. Survey tables are read and
// written with the service role only here, never from the browser.
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchSurveyQuestions } from '@/lib/data/surveys'
import { questionsForStage } from '@/lib/data/survey-setup'
import { checkAnswers } from '@/lib/data/survey-answers'
import { isValidEmail, maskEmail, normalizeEmail } from '@/lib/data/survey-participants'
import type { SubmissionChannel, SubmissionStage } from '@/lib/data/surveys.types'
import { PERSON_COOKIE, signPerson, verifyPerson } from '@/lib/surveys/tokens'
import {
  joinByEmail, joinSurvey, loadPublicSurvey, participantByToken, personEmail, saveAnswers,
  type KnownParticipant, type PublicSurvey, type SaveOutcome,
} from '@/lib/surveys/respond'
import { sendConfirmation } from '@/lib/surveys/email/send'

const COOKIE_DAYS = 180

async function rememberPerson(personId: string) {
  const store = await cookies()
  store.set(PERSON_COOKIE, signPerson(personId), {
    httpOnly: true,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production',
    path:     '/',
    maxAge:   COOKIE_DAYS * 24 * 60 * 60,
  })
}

async function openSurvey(slug: string, stage: SubmissionStage): Promise<PublicSurvey | string> {
  if (stage !== 'pre' && stage !== 'post') return 'This survey link isn\'t right.'
  const survey = await loadPublicSurvey(createAdminClient(), String(slug), stage)
  if (!survey) return 'This survey isn\'t available.'
  if (survey.window === 'not_open') return 'This survey isn\'t open yet.'
  if (survey.window === 'closed') return 'This survey has closed.'
  return survey
}

export async function startWithEmail(slug: string, stage: SubmissionStage, rawEmail: string): Promise<{ ok: true; masked: string } | { ok: false; error: string }> {
  const email = normalizeEmail(String(rawEmail ?? ''))
  if (!isValidEmail(email)) return { ok: false, error: 'Check the email address: it doesn\'t look complete.' }
  const survey = await openSurvey(slug, stage)
  if (typeof survey === 'string') return { ok: false, error: survey }

  const person = await joinByEmail(createAdminClient(), survey.id, email)
  await rememberPerson(person.personId)
  return { ok: true, masked: maskEmail(email) }
}

// "Not you?": this device stops remembering the person
export async function forgetDevice(): Promise<void> {
  const store = await cookies()
  store.delete(PERSON_COOKIE)
}

export type SubmitResult =
  | { ok: true; outcome: SaveOutcome; confirmationSent: boolean }
  | { ok: false; error: string; versionId?: string }

export async function submitAnswers(
  slug: string,
  stage: SubmissionStage,
  answers: Record<string, unknown>,
  token: string | null,
  via: 'token' | 'email' | 'cookie',
): Promise<SubmitResult> {
  const survey = await openSurvey(slug, stage)
  if (typeof survey === 'string') return { ok: false, error: survey }
  const db = createAdminClient()

  // Who is answering: their own link first, then this device
  let who: KnownParticipant | null = token ? await participantByToken(db, survey.id, String(token)) : null
  const byToken = who !== null
  if (!who) {
    const personId = verifyPerson((await cookies()).get(PERSON_COOKIE)?.value)
    if (!personId) return { ok: false, error: 'Enter your email first, so your answers can be matched.' }
    who = { participantId: await joinSurvey(db, survey.id, personId), personId, email: await personEmail(db, personId) }
  }

  const questions = questionsForStage(await fetchSurveyQuestions(db, survey.id), stage)
  const checked = checkAnswers(questions, answers ?? {})
  if ('error' in checked) return { ok: false, error: checked.error, versionId: checked.versionId }

  const channel: SubmissionChannel = byToken ? 'email_link' : via === 'email' ? 'qr_email' : 'qr_cookie'
  const outcome = await saveAnswers(db, { participantId: who.participantId, stage, channel, byToken, values: checked.values })
  await rememberPerson(who.personId)

  // Answered the before-survey without their own link (QR): email them the after link.
  // A failed email doesn't undo the answers; it's in the email log for the admins.
  let confirmationSent = false
  if (stage === 'pre' && !byToken && outcome === 'accepted') {
    confirmationSent = await sendConfirmation(db, who.participantId)
  }
  return { ok: true, outcome, confirmationSent }
}

// "Stop reminders for this survey" (every reminder email's footer). Takes the person's own
// link token, so only they can switch their reminders off; invites still arrive.
export async function stopReminders(slug: string, token: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = createAdminClient()
  const survey = await loadPublicSurvey(db, String(slug), 'pre')
  if (!survey) return { ok: false, error: 'This survey isn\'t available.' }
  const who = await participantByToken(db, survey.id, String(token ?? ''))
  if (!who) return { ok: false, error: 'This link isn\'t valid. Use the link in your most recent survey email.' }
  const updated = await db.from('survey_event_participants')
    .update({ reminders_off_at: new Date().toISOString() }).eq('id', who.participantId).is('reminders_off_at', null)
  if (updated.error) throw new Error(`reminders update failed: ${updated.error.message}`)
  return { ok: true }
}
