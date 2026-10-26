// Server only. Managing the core questions (Academy dashboard → Core questions), as plain
// helpers that take a client; app/dashboard/academy/core-questions/actions.ts adds the role
// check. Rules (docs/surveys/PLAN.md section 5):
//   - a version nobody has answered is edited in place, so every survey using it changes
//   - once anyone has answered a version, saving creates the next version: new surveys and
//     surveys nobody has answered yet move to it; answered surveys keep the wording people saw
//   - the type and when it's asked (before / after / both) never change: that would break
//     comparisons; retire the question and add a new one instead
//   - retiring stops new surveys asking it; existing surveys keep it
import type { SupabaseClient } from '@supabase/supabase-js'
import { must } from '@/lib/supabase/must'
import { coreKey } from '@/lib/data/survey-setup'
import { isSurveyLocked } from '@/lib/data/surveys'
import type { QuestionInput, QuestionStage, QuestionType } from '@/lib/data/surveys.types'

export interface CoreVersionView {
  versionId:     string
  version:       number
  text:          string
  options:       string[] | null
  scaleMinLabel: string | null
  scaleMaxLabel: string | null
  isRequired:    boolean
  createdAt:     string
  surveys:       number   // surveys asking this version
  answers:       number   // answers given to it (any survey)
}

export interface CoreQuestionView {
  questionId: string
  key:        string
  type:       QuestionType
  stage:      QuestionStage
  coreOrder:  number | null
  retiredAt:  string | null
  versions:   CoreVersionView[]   // newest first
}

const versionRow = (q: QuestionInput) => ({
  text:            q.text,
  options:         q.options.length > 0 ? q.options : null,
  scale_min_label: q.scaleMinLabel || null,
  scale_max_label: q.scaleMaxLabel || null,
  is_required:     q.isRequired,
})

export async function loadCoreQuestions(db: SupabaseClient): Promise<CoreQuestionView[]> {
  const questions = must('core questions query', await db.from('survey_questions')
    .select('id,key,type,stage,core_order,retired_at,survey_question_versions(id,version,text,options,scale_min_label,scale_max_label,is_required,created_at)')
    .eq('is_core', true)) as unknown as {
      id: string; key: string; type: QuestionType; stage: QuestionStage; core_order: number | null; retired_at: string | null
      survey_question_versions: { id: string; version: number; text: string; options: string[] | null; scale_min_label: string | null; scale_max_label: string | null; is_required: boolean; created_at: string }[]
    }[]

  const versionIds = questions.flatMap(q => q.survey_question_versions.map(v => v.id))
  const uses = must('core question use query', await db.from('survey_event_questions')
    .select('question_version_id').in('question_version_id', versionIds.length ? versionIds : ['00000000-0000-0000-0000-000000000000'])) as { question_version_id: string }[]
  const surveys = new Map<string, number>()
  for (const u of uses) surveys.set(u.question_version_id, (surveys.get(u.question_version_id) ?? 0) + 1)
  const answers = new Map(await Promise.all(versionIds.map(async id => {
    const res = await db.from('survey_answers').select('id', { count: 'exact', head: true }).eq('question_version_id', id)
    if (res.error) throw new Error(`answer count failed: ${res.error.message}`)
    return [id, res.count ?? 0] as const
  })))

  return questions
    .map(q => ({
      questionId: q.id, key: q.key, type: q.type, stage: q.stage, coreOrder: q.core_order, retiredAt: q.retired_at,
      versions: q.survey_question_versions
        .sort((a, b) => b.version - a.version)
        .map(v => ({
          versionId: v.id, version: v.version, text: v.text, options: v.options,
          scaleMinLabel: v.scale_min_label, scaleMaxLabel: v.scale_max_label, isRequired: v.is_required, createdAt: v.created_at,
          surveys: surveys.get(v.id) ?? 0, answers: answers.get(v.id) ?? 0,
        })),
    }))
    .sort((a, b) => (a.coreOrder ?? Number.MAX_SAFE_INTEGER) - (b.coreOrder ?? Number.MAX_SAFE_INTEGER) || a.key.localeCompare(b.key))
}

export type SaveCoreResult =
  | { mode: 'edited'; version: number }
  | { mode: 'versioned'; version: number; movedSurveys: number; keptSurveys: number }

// Saves new wording, choices, scale labels or "required" for a core question
export async function saveCoreQuestion(db: SupabaseClient, questionId: string, q: QuestionInput): Promise<SaveCoreResult | { error: string }> {
  const question = must('core question query', await db.from('survey_questions')
    .select('id,is_core,survey_question_versions(id,version)').eq('id', questionId).maybeSingle()) as
    { id: string; is_core: boolean; survey_question_versions: { id: string; version: number }[] } | null
  if (!question || !question.is_core) return { error: 'That core question no longer exists. Refresh the page.' }
  const latest = [...question.survey_question_versions].sort((a, b) => b.version - a.version)[0]
  if (!latest) return { error: 'This question has no wording yet.' }

  const answered = await db.from('survey_answers').select('id', { count: 'exact', head: true }).eq('question_version_id', latest.id)
  if (answered.error) throw new Error(`answer count failed: ${answered.error.message}`)

  if ((answered.count ?? 0) === 0) {
    must('core question update', await db.from('survey_question_versions').update(versionRow(q)).eq('id', latest.id))
    return { mode: 'edited', version: latest.version }
  }

  const next = must('core version insert', await db.from('survey_question_versions')
    .insert({ question_id: questionId, version: latest.version + 1, ...versionRow(q) })
    .select('id').single()) as { id: string }

  // Surveys nobody has answered yet switch to the new wording; answered ones keep theirs
  const using = must('core question use query', await db.from('survey_event_questions')
    .select('survey_event_id').eq('question_version_id', latest.id)) as { survey_event_id: string }[]
  let moved = 0
  for (const { survey_event_id } of using) {
    if (await isSurveyLocked(db, survey_event_id)) continue
    must('survey question switch', await db.from('survey_event_questions')
      .update({ question_version_id: next.id }).eq('survey_event_id', survey_event_id).eq('question_version_id', latest.id))
    moved++
  }
  return { mode: 'versioned', version: latest.version + 1, movedSurveys: moved, keptSurveys: using.length - moved }
}

// A new core question: new surveys ask it from now on (existing surveys don't change)
export async function addCoreQuestion(db: SupabaseClient, q: QuestionInput): Promise<{ key: string }> {
  const existing = must('core keys query', await db.from('survey_questions').select('key,core_order').like('key', 'core.%')) as { key: string; core_order: number | null }[]
  const key = coreKey(q.text, existing.map(e => e.key))
  const order = Math.max(0, ...existing.map(e => e.core_order ?? 0)) + 1
  const question = must('core question insert', await db.from('survey_questions')
    .insert({ key, is_core: true, type: q.type, stage: q.stage, in_bank: false, core_order: order })
    .select('id').single()) as { id: string }
  const version = await db.from('survey_question_versions').insert({ question_id: question.id, version: 1, ...versionRow(q) })
  if (version.error) {
    must('core question undo', await db.from('survey_questions').delete().eq('id', question.id))
    throw new Error(`core question version insert failed: ${version.error.message}`)
  }
  return { key }
}

export async function setCoreRetired(db: SupabaseClient, questionId: string, retired: boolean): Promise<void> {
  must('core question retire', await db.from('survey_questions')
    .update({ retired_at: retired ? new Date().toISOString() : null }).eq('id', questionId).eq('is_core', true))
}

// Swaps a core question with its neighbour in the order new surveys ask them
export async function moveCoreQuestion(db: SupabaseClient, questionId: string, direction: 'up' | 'down'): Promise<void> {
  const active = (await loadOrder(db))
  const index = active.findIndex(q => q.id === questionId)
  const neighbour = active[direction === 'up' ? index - 1 : index + 1]
  if (index === -1 || !neighbour) return
  // Number the list 1…n first, so equal or missing positions can't make the swap a no-op
  for (const [i, q] of active.entries()) {
    if (q.core_order !== i + 1) must('core order update', await db.from('survey_questions').update({ core_order: i + 1 }).eq('id', q.id))
  }
  must('core order update', await db.from('survey_questions').update({ core_order: (direction === 'up' ? index : index + 2) }).eq('id', questionId))
  must('core order update', await db.from('survey_questions').update({ core_order: index + 1 }).eq('id', neighbour.id))
}

async function loadOrder(db: SupabaseClient) {
  const rows = must('core order query', await db.from('survey_questions')
    .select('id,key,core_order').eq('is_core', true).is('retired_at', null)) as { id: string; key: string; core_order: number | null }[]
  return rows.sort((a, b) => (a.core_order ?? Number.MAX_SAFE_INTEGER) - (b.core_order ?? Number.MAX_SAFE_INTEGER) || a.key.localeCompare(b.key))
}
