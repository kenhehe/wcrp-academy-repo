// Server only. The participant side of a survey, as plain helpers that take a client:
// find the survey, recognise the person (link token, device cookie, typed email) and save
// their answers. app/s/actions.ts wraps these; scripts can call them directly.
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { must } from '@/lib/supabase/must'
import type { AnswerValues } from '@/lib/data/survey-answers'
import { stageWindow, type StageWindow } from '@/lib/data/survey-setup'
import type { SubmissionChannel, SubmissionStage, SurveyStatus } from '@/lib/data/surveys.types'
import { hashToken } from './tokens'
import { ensurePeople, participantRows } from './participants'

export interface PublicSurvey {
  id:       string
  slug:     string
  title:    string
  status:   SurveyStatus
  opensAt:  string | null   // this stage's window
  closesAt: string | null
  postOpensAt: string | null
  window:   StageWindow     // open, not open yet, or closed, right now
}

// The survey behind /s/[slug]/[stage]; drafts don't exist as far as participants are concerned
export async function loadPublicSurvey(db: SupabaseClient, slug: string, stage: SubmissionStage): Promise<PublicSurvey | null> {
  const row = must('public survey query', await db.from('survey_events')
    .select('id,slug,title,status,pre_opens_at,pre_closes_at,post_opens_at,post_closes_at')
    .eq('slug', slug).maybeSingle()) as {
      id: string; slug: string; title: string; status: SurveyStatus
      pre_opens_at: string | null; pre_closes_at: string | null; post_opens_at: string | null; post_closes_at: string | null
    } | null
  if (!row || row.status === 'draft') return null
  const opensAt  = stage === 'pre' ? row.pre_opens_at  : row.post_opens_at
  const closesAt = stage === 'pre' ? row.pre_closes_at : row.post_closes_at
  return {
    id: row.id, slug: row.slug, title: row.title, status: row.status, opensAt, closesAt,
    postOpensAt: row.post_opens_at,
    window: stageWindow(row.status, opensAt, closesAt, Date.now()),
  }
}

// The person's participant row in this survey, if they're in it (doesn't add them)
export async function findParticipant(db: SupabaseClient, surveyId: string, personId: string): Promise<string | null> {
  const row = must('participant query', await db.from('survey_event_participants')
    .select('id').eq('survey_event_id', surveyId).eq('person_id', personId).maybeSingle()) as { id: string } | null
  return row?.id ?? null
}

export interface KnownParticipant {
  participantId: string
  personId:      string
  email:         string | null
}

export async function participantByToken(db: SupabaseClient, surveyId: string, token: string): Promise<KnownParticipant | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null
  const row = must('token lookup', await db.from('survey_event_participants')
    .select('id,person_id,survey_people(email)')
    .eq('survey_event_id', surveyId).eq('token_hash', hashToken(token)).maybeSingle()) as unknown as
    { id: string; person_id: string; survey_people: { email: string | null } | null } | null
  return row ? { participantId: row.id, personId: row.person_id, email: row.survey_people?.email ?? null } : null
}

export async function personEmail(db: SupabaseClient, personId: string): Promise<string | null> {
  const row = must('person query', await db.from('survey_people').select('email').eq('id', personId).maybeSingle()) as { email: string | null } | null
  return row?.email ?? null
}

// The person's participant row in this survey, adding them as a walk-in when they aren't in it
export async function joinSurvey(db: SupabaseClient, surveyId: string, personId: string): Promise<string> {
  const existing = await findParticipant(db, surveyId, personId)
  if (existing) return existing
  const [row] = participantRows(surveyId, [personId], 'walk_in')
  const inserted = await db.from('survey_event_participants').insert(row)
  if (inserted.error?.code === '23505') {
    // Joined a moment ago in another tab
    const again = must('participant query', await db.from('survey_event_participants')
      .select('id').eq('survey_event_id', surveyId).eq('person_id', personId).single()) as { id: string }
    return again.id
  }
  must('walk-in insert', inserted)
  return row.id
}

// Someone typing an email (QR code): find or create the person, then join the survey
export async function joinByEmail(db: SupabaseClient, surveyId: string, email: string): Promise<KnownParticipant> {
  const personId = (await ensurePeople(db, [email])).get(email)
  if (!personId) throw new Error('person upsert returned no id')
  return { participantId: await joinSurvey(db, surveyId, personId), personId, email }
}

export async function acceptedSubmission(db: SupabaseClient, participantId: string, stage: SubmissionStage): Promise<{ id: string; submitted_at: string } | null> {
  return must('submission query', await db.from('survey_submissions')
    .select('id,submitted_at').eq('event_participant_id', participantId).eq('stage', stage).eq('status', 'accepted').maybeSingle()) as { id: string; submitted_at: string } | null
}

export type SaveOutcome = 'accepted' | 'replaced' | 'flagged'

async function insertSubmission(db: SupabaseClient, participantId: string, stage: SubmissionStage, channel: SubmissionChannel, status: 'accepted' | 'flagged_duplicate', values: Map<string, AnswerValues>) {
  const id = randomUUID()
  const inserted = await db.from('survey_submissions').insert({ id, event_participant_id: participantId, stage, channel, status })
  if (inserted.error) return inserted.error
  const answers = await db.from('survey_answers').insert([...values].map(([versionId, v]) => ({ submission_id: id, question_version_id: versionId, ...v })))
  if (answers.error) {
    must('submission undo', await db.from('survey_submissions').delete().eq('id', id))
    throw new Error(`answers insert failed: ${answers.error.message}`)
  }
  return id
}

// Saves one set of answers. The first set per stage is accepted. A later one through the
// person's own link replaces it; a later one any other way (typed email, remembered device)
// is kept as a flagged duplicate for review, so nobody can overwrite someone else's answers.
export async function saveAnswers(
  db: SupabaseClient,
  { participantId, stage, channel, byToken, values }: { participantId: string; stage: SubmissionStage; channel: SubmissionChannel; byToken: boolean; values: Map<string, AnswerValues> },
): Promise<SaveOutcome> {
  const existing = await acceptedSubmission(db, participantId, stage)

  if (existing && byToken) {
    // New set first (flagged, so the one-accepted rule holds), then swap: if anything fails
    // half-way, the old answers are still there
    const fresh = await insertSubmission(db, participantId, stage, channel, 'flagged_duplicate', values)
    if (typeof fresh !== 'string') throw new Error(`submission insert failed: ${fresh.message}`)
    must('old submission delete', await db.from('survey_submissions').delete().eq('id', existing.id))
    must('submission accept', await db.from('survey_submissions').update({ status: 'accepted' }).eq('id', fresh))
    return 'replaced'
  }

  const first = await insertSubmission(db, participantId, stage, channel, existing ? 'flagged_duplicate' : 'accepted', values)
  if (typeof first === 'string') return existing ? 'flagged' : 'accepted'
  // Another accepted set landed in between (two tabs): keep this one as a duplicate
  if (first.code === '23505') {
    const second = await insertSubmission(db, participantId, stage, channel, 'flagged_duplicate', values)
    if (typeof second !== 'string') throw new Error(`submission insert failed: ${second.message}`)
    return 'flagged'
  }
  throw new Error(`submission insert failed: ${first.message}`)
}
