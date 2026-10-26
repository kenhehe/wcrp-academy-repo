'use server'

// Participants tab: import, remove, merge, copy a personal link (Academy admins only).
// The work is in lib/surveys/participants.ts; these add the role check, the audit log and
// revalidation. Expected problems come back as { ok: false, error }; query failures throw.
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAcademyAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { must } from '@/lib/supabase/must'
import type { ActionResult, SubmissionStage } from '@/lib/data/surveys.types'
import { importEmails, mergeParticipantRows, removeParticipantRow, type ImportSummary } from '@/lib/surveys/participants'
import { participantToken } from '@/lib/surveys/tokens'
import { surveyLink, surveysBaseUrl } from '@/lib/surveys/base-url'

const MAX_IMPORT = 5000
const fail = (error: string) => ({ ok: false as const, error })

async function logAction(db: SupabaseClient, actorId: string, action: string, surveyId: string, detail: Record<string, unknown>) {
  must('survey admin log insert', await db.from('survey_admin_log').insert({ actor_id: actorId, action, survey_event_id: surveyId, detail }))
}

export async function importParticipants(surveyId: string, entries: string[]): Promise<ActionResult<{ summary: ImportSummary }>> {
  const user = await requireAcademyAdmin()
  if (!Array.isArray(entries) || entries.length === 0) return fail('Nothing to import.')
  if (entries.length > MAX_IMPORT) return fail(`Import at most ${MAX_IMPORT.toLocaleString('en-GB')} addresses at a time.`)

  const db = createAdminClient()
  const result = await importEmails(db, surveyId, entries)
  if ('error' in result) return fail(result.error)
  const { summary } = result
  await logAction(db, user.id, 'participants.import', surveyId, { added: summary.added, already: summary.already, invalid: summary.invalid.length })

  revalidatePath('/dashboard/academy/surveys', 'layout')
  return { ok: true, summary }
}

export async function removeParticipant(surveyId: string, participantId: string): Promise<ActionResult> {
  const user = await requireAcademyAdmin()
  const db = createAdminClient()
  const result = await removeParticipantRow(db, surveyId, participantId)
  if ('error' in result) return fail(result.error)
  await logAction(db, user.id, 'participant.remove', surveyId, { participant_id: participantId })

  revalidatePath('/dashboard/academy/surveys', 'layout')
  return { ok: true }
}

export async function mergeParticipants(surveyId: string, keepId: string, mergeId: string): Promise<ActionResult> {
  const user = await requireAcademyAdmin()
  const db = createAdminClient()
  const result = await mergeParticipantRows(db, surveyId, keepId, mergeId, user.id)
  if ('error' in result) return fail(result.error)
  await logAction(db, user.id, 'participant.merge', surveyId, { kept: keepId, merged: mergeId })

  revalidatePath('/dashboard/academy/surveys', 'layout')
  return { ok: true }
}

// The person's own link, e.g. to paste into a message or to try the survey as them
export async function participantLink(surveyId: string, participantId: string, stage: SubmissionStage): Promise<ActionResult<{ url: string }>> {
  await requireAcademyAdmin()
  if (stage !== 'pre' && stage !== 'post') return fail('Unknown stage.')
  const db = createAdminClient()
  const row = must('participant query', await db.from('survey_event_participants')
    .select('id,survey_events(slug)').eq('id', participantId).eq('survey_event_id', surveyId).maybeSingle()) as unknown as { id: string; survey_events: { slug: string } } | null
  if (!row) return fail('That person is no longer in this survey.')
  return { ok: true, url: surveyLink(await surveysBaseUrl(), row.survey_events.slug, stage, participantToken(row.id)) }
}
