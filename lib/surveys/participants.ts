// Server only. Participant changes as plain helpers that take a client: the server actions
// (app/dashboard/academy/surveys/participant-actions.ts) add the role check, and scripts can
// call these directly. Expected problems come back as { error }; query failures throw.
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { must } from '@/lib/supabase/must'
import { cleanEmailList } from '@/lib/data/survey-participants'
import type { ParticipantSource, SubmissionStage } from '@/lib/data/surveys.types'
import { hashToken, participantToken } from './tokens'

async function chunked<T>(items: T[], size: number, fn: (chunk: T[]) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await fn(items.slice(i, i + size))
}

export interface ImportSummary {
  added:    number
  already:  number     // were in this survey already
  repeated: number     // listed more than once
  invalid:  string[]   // not email addresses, as typed
}

// New rows for survey_event_participants, each with its personal-link token hash
export function participantRows(surveyId: string, personIds: string[], source: ParticipantSource) {
  return personIds.map(personId => {
    const id = randomUUID()
    return { id, survey_event_id: surveyId, person_id: personId, token_hash: hashToken(participantToken(id)), source }
  })
}

// People are shared across surveys: adds the addresses that are new, returns everyone's id
export async function ensurePeople(db: SupabaseClient, emails: string[]): Promise<Map<string, string>> {
  await chunked(emails, 500, async chunk => {
    must('people insert', await db.from('survey_people').upsert(chunk.map(email => ({ email })), { onConflict: 'email', ignoreDuplicates: true }))
  })
  const ids = new Map<string, string>()
  await chunked(emails, 150, async chunk => {
    const rows = must('people query', await db.from('survey_people').select('id,email').in('email', chunk)) as { id: string; email: string }[]
    for (const r of rows) ids.set(r.email, r.id)
  })
  return ids
}

export async function importEmails(db: SupabaseClient, surveyId: string, entries: string[]): Promise<{ summary: ImportSummary } | { error: string }> {
  const { valid, invalid, repeated } = cleanEmailList(entries.map(String))
  if (valid.length === 0) return { error: invalid.length > 0 ? `None of these are email addresses: ${invalid.slice(0, 3).join(', ')}…` : 'Nothing to import.' }

  const survey = must('survey query', await db.from('survey_events').select('id,status').eq('id', surveyId).maybeSingle()) as { id: string; status: string } | null
  if (!survey) return { error: 'Survey not found.' }
  if (survey.status === 'closed') return { error: 'This survey is closed, so nobody new can join it.' }

  const personIds = await ensurePeople(db, valid)
  const inSurvey = new Set<string>()
  await chunked([...personIds.values()], 150, async chunk => {
    const rows = must('participants query', await db.from('survey_event_participants')
      .select('person_id').eq('survey_event_id', surveyId).in('person_id', chunk)) as { person_id: string }[]
    for (const r of rows) inSurvey.add(r.person_id)
  })

  const fresh = valid.map(email => personIds.get(email)).filter((id): id is string => id !== undefined && !inSurvey.has(id))
  const rows = participantRows(surveyId, fresh, 'imported')
  await chunked(rows, 500, async chunk => {
    must('participants insert', await db.from('survey_event_participants').insert(chunk))
  })
  return { summary: { added: rows.length, already: valid.length - rows.length, repeated, invalid } }
}

export async function removeParticipantRow(db: SupabaseClient, surveyId: string, participantId: string): Promise<{ ok: true } | { error: string }> {
  const answered = await db.from('survey_submissions').select('id', { count: 'exact', head: true }).eq('event_participant_id', participantId)
  if (answered.error) throw new Error(`answers check failed: ${answered.error.message}`)
  if ((answered.count ?? 0) > 0) return { error: 'This person has answered, so they stay in the survey. If it\'s the same person as another address, merge the two instead.' }
  const removed = must('participant delete', await db.from('survey_event_participants')
    .delete().eq('id', participantId).eq('survey_event_id', surveyId).select('id')) as { id: string }[]
  return removed.length > 0 ? { ok: true } : { error: 'That person is no longer in this survey.' }
}

// Two addresses in one survey that belong to one person (work before, Gmail after): the
// second participant's answers and emails move to the first, then the second is removed.
// A stage both answered keeps the kept participant's answers; the other set is flagged.
export async function mergeParticipantRows(db: SupabaseClient, surveyId: string, keepId: string, mergeId: string, actorId: string | null): Promise<{ ok: true } | { error: string }> {
  if (keepId === mergeId) return { error: 'Pick two different people.' }
  const pair = must('participants query', await db.from('survey_event_participants')
    .select('id,person_id,source').eq('survey_event_id', surveyId).in('id', [keepId, mergeId])) as { id: string; person_id: string; source: ParticipantSource }[]
  const keep = pair.find(p => p.id === keepId), merged = pair.find(p => p.id === mergeId)
  if (!keep || !merged) return { error: 'Both people must be in this survey. Refresh the page.' }

  const subs = must('submissions query', await db.from('survey_submissions')
    .select('id,event_participant_id,stage,status').in('event_participant_id', [keepId, mergeId])) as { id: string; event_participant_id: string; stage: SubmissionStage; status: string }[]
  const keptStages = new Set(subs.filter(s => s.event_participant_id === keepId && s.status === 'accepted').map(s => s.stage))
  for (const s of subs.filter(s => s.event_participant_id === mergeId)) {
    // Flag in the same update as the move: the kept participant may already have this stage
    const status = s.status === 'accepted' && keptStages.has(s.stage) ? 'flagged_duplicate' : s.status
    must('submission move', await db.from('survey_submissions').update({ status, event_participant_id: keepId }).eq('id', s.id))
  }
  must('email log move', await db.from('survey_email_log').update({ event_participant_id: keepId }).eq('event_participant_id', mergeId))
  if (merged.source === 'imported' && keep.source !== 'imported') {
    must('source update', await db.from('survey_event_participants').update({ source: 'imported' }).eq('id', keepId))
  }
  must('participant delete', await db.from('survey_event_participants').delete().eq('id', mergeId))

  // The merged address goes too, unless another survey still has it
  const elsewhere = await db.from('survey_event_participants').select('id', { count: 'exact', head: true }).eq('person_id', merged.person_id)
  if (elsewhere.error) throw new Error(`person use check failed: ${elsewhere.error.message}`)
  if ((elsewhere.count ?? 0) === 0) must('person delete', await db.from('survey_people').delete().eq('id', merged.person_id))
  must('merge log insert', await db.from('survey_merges').insert({ kept_person_id: keep.person_id, merged_person_id: merged.person_id, merged_by: actorId }))
  return { ok: true }
}
