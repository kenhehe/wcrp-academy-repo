'use server'

// Create and edit surveys (Academy admins only). Every action re-checks the role: a server
// action is a public endpoint whatever page shows its button. Expected problems come back
// as { ok: false, error } for a toast; query failures throw.
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAcademyAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { must } from '@/lib/supabase/must'
import { fetchCoreQuestions, fetchSurveyQuestions, isSurveyLocked } from '@/lib/data/surveys'
import {
  checkQuestionInput, checkSurveyTimes, checkTitle, normalizeQuestionInput, questionsForStage, slugify, uniqueSlug,
} from '@/lib/data/survey-setup'
import {
  EDITABLE_QUESTION_TYPES, QUESTION_STAGES,
  type ActionResult, type NewSurveyInput, type QuestionInput, type SubmissionStage, type SurveyDetailsInput,
  type SurveyQuestionItem, type SurveyStatus, type SurveyTimesInput,
} from '@/lib/data/surveys.types'
import { syncJobs } from '@/lib/surveys/email/send'

const MAX_OWN_QUESTIONS = 30
const LOCKED = 'Questions are locked: people have already answered this survey.'

const fail = (error: string) => ({ ok: false as const, error })

function revalidateSurveys() {
  revalidatePath('/dashboard/academy/surveys', 'layout')
}

function timesRow(t: SurveyTimesInput) {
  const iso = (v: string) => new Date(v).toISOString()
  return {
    event_starts_at: iso(t.eventStartsAt),
    event_ends_at:   iso(t.eventEndsAt),
    pre_opens_at:    iso(t.preOpensAt),
    pre_closes_at:   iso(t.preClosesAt),
    post_opens_at:   iso(t.postOpensAt),
    post_closes_at:  iso(t.postClosesAt),
  }
}

// Client input arrives untyped at runtime: check types and stages against the fixed lists
function readQuestion(raw: QuestionInput): { question: QuestionInput } | { error: string } {
  if (!raw || !(EDITABLE_QUESTION_TYPES as readonly string[]).includes(raw.type)) return { error: 'Pick an answer type.' }
  if (!(QUESTION_STAGES as readonly string[]).includes(raw.stage)) return { error: 'Pick when the question is asked.' }
  const question = normalizeQuestionInput({
    text:          String(raw.text ?? ''),
    type:          raw.type,
    stage:         raw.stage,
    options:       Array.isArray(raw.options) ? raw.options.map(String) : [],
    scaleMinLabel: String(raw.scaleMinLabel ?? ''),
    scaleMaxLabel: String(raw.scaleMaxLabel ?? ''),
    isRequired:    raw.isRequired !== false,
  })
  const problem = checkQuestionInput(question)
  return problem ? { error: problem } : { question }
}

async function logAction(db: SupabaseClient, actorId: string, action: string, surveyId: string | null, detail: Record<string, unknown> = {}) {
  must('survey admin log insert', await db.from('survey_admin_log').insert({ actor_id: actorId, action, survey_event_id: surveyId, detail }))
}

// An event's own question, version 1
async function insertOwnQuestion(db: SupabaseClient, q: QuestionInput): Promise<{ questionId: string; versionId: string }> {
  const question = must('question insert', await db
    .from('survey_questions')
    .insert({ key: `custom.${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`, is_core: false, type: q.type, stage: q.stage, in_bank: true })
    .select('id')
    .single()) as { id: string }
  const version = must('question version insert', await db
    .from('survey_question_versions')
    .insert({
      question_id:     question.id,
      version:         1,
      text:            q.text,
      options:         q.options.length > 0 ? q.options : null,
      scale_min_label: q.scaleMinLabel || null,
      scale_max_label: q.scaleMaxLabel || null,
      is_required:     q.isRequired,
    })
    .select('id')
    .single()) as { id: string }
  return { questionId: question.id, versionId: version.id }
}

// Removes own questions that no survey asks any more. Core questions are never touched.
async function deleteUnusedOwnQuestions(db: SupabaseClient, questionIds: string[]) {
  for (const questionId of questionIds) {
    const versions = must('question versions query', await db
      .from('survey_question_versions').select('id').eq('question_id', questionId)) as { id: string }[]
    const versionIds = versions.map(v => v.id)
    if (versionIds.length > 0) {
      const used = await db.from('survey_event_questions')
        .select('question_version_id', { count: 'exact', head: true })
        .in('question_version_id', versionIds)
      if (used.error) throw new Error(`question use query failed: ${used.error.message}`)
      if ((used.count ?? 0) > 0) continue
      must('question versions delete', await db.from('survey_question_versions').delete().in('id', versionIds))
    }
    must('question delete', await db.from('survey_questions').delete().eq('id', questionId).eq('is_core', false))
  }
}

// The survey's question by version, if it's still there and can still change
async function editableQuestion(db: SupabaseClient, surveyId: string, versionId: string): Promise<{ item: SurveyQuestionItem; all: SurveyQuestionItem[] } | { error: string }> {
  if (await isSurveyLocked(db, surveyId)) return { error: LOCKED }
  const all = await fetchSurveyQuestions(db, surveyId)
  const item = all.find(q => q.versionId === versionId)
  if (!item) return { error: 'That question is no longer in this survey. Refresh the page.' }
  return { item, all }
}

// ─── Surveys ──────────────────────────────────────────────────────────────────

export async function createSurvey(input: NewSurveyInput): Promise<ActionResult<{ slug: string }>> {
  const user = await requireAcademyAdmin()
  const title = String(input?.title ?? '').trim()
  const problem = checkTitle(title) ?? checkSurveyTimes(input)
  if (problem) return fail(problem)

  const own: QuestionInput[] = []
  for (const raw of Array.isArray(input.questions) ? input.questions : []) {
    const read = readQuestion(raw)
    if ('error' in read) return fail(read.error)
    own.push(read.question)
  }
  if (own.length > MAX_OWN_QUESTIONS) return fail(`Keep it to ${MAX_OWN_QUESTIONS} questions of your own or fewer.`)

  const db = createAdminClient()
  const event = must('academy event query', await db
    .from('academy_events').select('id').eq('id', String(input.academyEventId ?? '')).maybeSingle()) as { id: string } | null
  if (!event) return fail('That Academy event no longer exists. Pick another one.')
  const existing = must('existing survey query', await db
    .from('survey_events').select('id').eq('academy_event_id', event.id).maybeSingle())
  if (existing) return fail('This Academy event already has a survey.')

  const base = slugify(title)
  const taken = must('slug query', await db
    .from('survey_events').select('slug').like('slug', `${base || 'survey'}%`)) as { slug: string }[]
  const slug = uniqueSlug(base, taken.map(r => r.slug))

  const inserted = await db
    .from('survey_events')
    .insert({ academy_event_id: event.id, slug, title, ...timesRow(input), status: 'draft', created_by: user.id })
    .select('id')
    .single()
  // Someone else created a survey for this event, or took the slug, a moment ago
  if (inserted.error?.code === '23505') return fail('Another survey was just created for this event or with this name. Refresh and try again.')
  const survey = must('survey insert', inserted) as { id: string }

  const ownQuestionIds: string[] = []
  try {
    const core = await fetchCoreQuestions(db)
    if (core.length === 0) throw new Error('No core questions in the database (supabase/migrations/20261026_survey_core_questions.sql)')
    const rows = core.map((q, i) => ({ survey_event_id: survey.id, question_version_id: q.versionId, stage: q.stage, sort_order: i }))
    for (const q of own) {
      const { questionId, versionId } = await insertOwnQuestion(db, q)
      ownQuestionIds.push(questionId)
      rows.push({ survey_event_id: survey.id, question_version_id: versionId, stage: q.stage, sort_order: rows.length })
    }
    must('survey questions insert', await db.from('survey_event_questions').insert(rows))
    await logAction(db, user.id, 'survey.create', survey.id, { slug, academy_event_id: event.id })
  } catch (err) {
    // The REST API has no transactions: remove the half-made survey before reporting the failure
    const undo = await db.from('survey_events').delete().eq('id', survey.id)
    if (undo.error) throw new Error(`${(err as Error).message}. Removing the half-made survey "${slug}" also failed: ${undo.error.message}`)
    await deleteUnusedOwnQuestions(db, ownQuestionIds)
    throw err
  }

  revalidateSurveys()
  return { ok: true, slug }
}

export async function updateSurveyDetails(surveyId: string, input: SurveyDetailsInput): Promise<ActionResult> {
  await requireAcademyAdmin()
  const title = String(input?.title ?? '').trim()
  const problem = checkTitle(title) ?? checkSurveyTimes(input)
  if (problem) return fail(problem)

  const db = createAdminClient()
  const updated = must('survey update', await db
    .from('survey_events')
    .update({ title, ...timesRow(input) })
    .eq('id', surveyId)
    .select('id')
    .maybeSingle())
  if (!updated) return fail('Survey not found. It may have been deleted.')
  // Scheduled emails follow the new windows
  await syncJobs(db, surveyId)

  revalidateSurveys()
  return { ok: true }
}

// Draft → active (people can answer inside the windows; scheduled emails are set up),
// active → closed (no more answers, pending emails cancelled), closed → active (reopen)
export async function setSurveyStatus(surveyId: string, status: SurveyStatus): Promise<ActionResult> {
  const user = await requireAcademyAdmin()
  const db = createAdminClient()
  const survey = must('survey query', await db.from('survey_events').select('id,status').eq('id', surveyId).maybeSingle()) as { id: string; status: SurveyStatus } | null
  if (!survey) return fail('Survey not found.')
  const allowed: Record<SurveyStatus, SurveyStatus[]> = { draft: ['active'], active: ['closed'], closed: ['active'] }
  if (!allowed[survey.status].includes(status)) return fail(`A ${survey.status} survey can't become ${status}.`)

  const changed = await db.from('survey_events').update({ status }).eq('id', surveyId)
  // The table refuses an active survey without all four window times
  if (changed.error?.code === '23514') return fail('Set when each survey opens and closes first (Name and dates).')
  must('survey status update', changed)
  if (status === 'active') await syncJobs(db, surveyId)
  if (status === 'closed') {
    must('jobs cancel', await db.from('survey_email_jobs').update({ status: 'cancelled' }).eq('survey_event_id', surveyId).in('status', ['scheduled', 'sending']))
  }
  await logAction(db, user.id, `survey.${status === 'active' ? (survey.status === 'draft' ? 'open' : 'reopen') : 'close'}`, surveyId)

  revalidateSurveys()
  return { ok: true }
}

export async function deleteSurvey(surveyId: string): Promise<ActionResult> {
  const user = await requireAcademyAdmin()
  const db = createAdminClient()
  const survey = must('survey query', await db
    .from('survey_events').select('id,slug,title,status').eq('id', surveyId).maybeSingle()) as { id: string; slug: string; title: string; status: string } | null
  if (!survey) return fail('Survey not found. It may already be deleted.')
  if (survey.status !== 'draft') return fail('Only draft surveys can be deleted.')
  if (await isSurveyLocked(db, surveyId)) return fail('People have answered this survey, so it can\'t be deleted.')

  const own = (await fetchSurveyQuestions(db, surveyId)).filter(q => !q.isCore).map(q => q.questionId)
  must('survey delete', await db.from('survey_events').delete().eq('id', surveyId))
  await deleteUnusedOwnQuestions(db, own)
  // The survey row is gone, so the log keeps its slug and title instead of the id
  await logAction(db, user.id, 'survey.delete', null, { survey_id: survey.id, slug: survey.slug, title: survey.title })

  revalidateSurveys()
  return { ok: true }
}

// ─── Questions ────────────────────────────────────────────────────────────────

export async function addSurveyQuestion(surveyId: string, raw: QuestionInput): Promise<ActionResult> {
  await requireAcademyAdmin()
  const read = readQuestion(raw)
  if ('error' in read) return fail(read.error)

  const db = createAdminClient()
  if (await isSurveyLocked(db, surveyId)) return fail(LOCKED)
  const current = await fetchSurveyQuestions(db, surveyId)
  if (current.filter(q => !q.isCore).length >= MAX_OWN_QUESTIONS) return fail(`Keep it to ${MAX_OWN_QUESTIONS} questions of your own or fewer.`)

  const { questionId, versionId } = await insertOwnQuestion(db, read.question)
  const linked = await db.from('survey_event_questions').insert({
    survey_event_id:     surveyId,
    question_version_id: versionId,
    stage:               read.question.stage,
    sort_order:          Math.max(-1, ...current.map(q => q.sortOrder)) + 1,
  })
  if (linked.error) {
    await deleteUnusedOwnQuestions(db, [questionId])
    throw new Error(`survey question link failed: ${linked.error.message}`)
  }

  revalidateSurveys()
  return { ok: true }
}

export async function updateSurveyQuestion(surveyId: string, versionId: string, raw: QuestionInput): Promise<ActionResult> {
  await requireAcademyAdmin()
  const read = readQuestion(raw)
  if ('error' in read) return fail(read.error)

  const db = createAdminClient()
  const found = await editableQuestion(db, surveyId, versionId)
  if ('error' in found) return fail(found.error)
  if (found.item.isCore) return fail('Core questions are the same in every survey and can\'t be changed here.')

  const uses = await db.from('survey_event_questions')
    .select('survey_event_id', { count: 'exact', head: true })
    .eq('question_version_id', versionId)
  if (uses.error) throw new Error(`question use query failed: ${uses.error.message}`)
  if ((uses.count ?? 0) > 1) return fail('Another survey asks this question too, so it can\'t be edited here.')

  const q = read.question
  must('question update', await db.from('survey_questions').update({ type: q.type, stage: q.stage }).eq('id', found.item.questionId))
  must('question version update', await db.from('survey_question_versions').update({
    text:            q.text,
    options:         q.options.length > 0 ? q.options : null,
    scale_min_label: q.scaleMinLabel || null,
    scale_max_label: q.scaleMaxLabel || null,
    is_required:     q.isRequired,
  }).eq('id', versionId))
  must('survey question stage update', await db.from('survey_event_questions')
    .update({ stage: q.stage }).eq('survey_event_id', surveyId).eq('question_version_id', versionId))

  revalidateSurveys()
  return { ok: true }
}

export async function removeSurveyQuestion(surveyId: string, versionId: string): Promise<ActionResult> {
  await requireAcademyAdmin()
  const db = createAdminClient()
  const found = await editableQuestion(db, surveyId, versionId)
  if ('error' in found) return fail(found.error)
  if (found.item.isCore) return fail('Core questions are part of every survey, so results can be compared.')

  must('survey question remove', await db.from('survey_event_questions')
    .delete().eq('survey_event_id', surveyId).eq('question_version_id', versionId))
  await deleteUnusedOwnQuestions(db, [found.item.questionId])

  revalidateSurveys()
  return { ok: true }
}

// Swaps a question with its neighbour in one stage's list (what the admin sees)
export async function moveSurveyQuestion(surveyId: string, versionId: string, direction: 'up' | 'down', stage: SubmissionStage): Promise<ActionResult> {
  await requireAcademyAdmin()
  if (direction !== 'up' && direction !== 'down') return fail('Unknown direction.')
  if (stage !== 'pre' && stage !== 'post') return fail('Unknown stage.')

  const db = createAdminClient()
  const found = await editableQuestion(db, surveyId, versionId)
  if ('error' in found) return fail(found.error)

  const list = questionsForStage(found.all, stage)
  const index = list.findIndex(q => q.versionId === versionId)
  const neighbour = list[direction === 'up' ? index - 1 : index + 1]
  if (index === -1 || !neighbour) return { ok: true }

  // Sort orders are distinct (create and add always number new rows past the end)
  must('question move', await db.from('survey_event_questions')
    .update({ sort_order: neighbour.sortOrder }).eq('survey_event_id', surveyId).eq('question_version_id', versionId))
  must('question move', await db.from('survey_event_questions')
    .update({ sort_order: found.item.sortOrder }).eq('survey_event_id', surveyId).eq('question_version_id', neighbour.versionId))

  revalidateSurveys()
  return { ok: true }
}
