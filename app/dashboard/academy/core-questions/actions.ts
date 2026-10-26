'use server'

// Core questions page (Academy admins only). The rules are in lib/surveys/core-questions.ts.
import { revalidatePath } from 'next/cache'
import { requireAcademyAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { must } from '@/lib/supabase/must'
import { checkQuestionInput, normalizeQuestionInput } from '@/lib/data/survey-setup'
import { EDITABLE_QUESTION_TYPES, QUESTION_STAGES, type ActionResult, type QuestionInput } from '@/lib/data/surveys.types'
import { addCoreQuestion, moveCoreQuestion, saveCoreQuestion, setCoreRetired, type SaveCoreResult } from '@/lib/surveys/core-questions'

const fail = (error: string) => ({ ok: false as const, error })

function revalidate() {
  revalidatePath('/dashboard/academy/core-questions')
  revalidatePath('/dashboard/academy/surveys', 'layout')
}

function readInput(raw: QuestionInput): { question: QuestionInput } | { error: string } {
  if (!raw || !(EDITABLE_QUESTION_TYPES as readonly string[]).includes(raw.type)) return { error: 'Pick an answer type.' }
  if (!(QUESTION_STAGES as readonly string[]).includes(raw.stage)) return { error: 'Pick when the question is asked.' }
  const question = normalizeQuestionInput({
    text: String(raw.text ?? ''), type: raw.type, stage: raw.stage,
    options: Array.isArray(raw.options) ? raw.options.map(String) : [],
    scaleMinLabel: String(raw.scaleMinLabel ?? ''), scaleMaxLabel: String(raw.scaleMaxLabel ?? ''),
    isRequired: raw.isRequired !== false,
  })
  const problem = checkQuestionInput(question)
  return problem ? { error: problem } : { question }
}

async function log(actorId: string, action: string, detail: Record<string, unknown>) {
  must('survey admin log insert', await createAdminClient().from('survey_admin_log').insert({ actor_id: actorId, action, survey_event_id: null, detail }))
}

export async function saveCore(questionId: string, raw: QuestionInput): Promise<ActionResult<{ result: SaveCoreResult }>> {
  const user = await requireAcademyAdmin()
  const read = readInput(raw)
  if ('error' in read) return fail(read.error)
  const result = await saveCoreQuestion(createAdminClient(), questionId, read.question)
  if ('error' in result) return fail(result.error)
  await log(user.id, result.mode === 'edited' ? 'core.edit' : 'core.new_version', { question_id: questionId, version: result.version })
  revalidate()
  return { ok: true, result }
}

export async function addCore(raw: QuestionInput): Promise<ActionResult<{ key: string }>> {
  const user = await requireAcademyAdmin()
  const read = readInput(raw)
  if ('error' in read) return fail(read.error)
  const { key } = await addCoreQuestion(createAdminClient(), read.question)
  await log(user.id, 'core.add', { key })
  revalidate()
  return { ok: true, key }
}

export async function retireCore(questionId: string, retired: boolean): Promise<ActionResult> {
  const user = await requireAcademyAdmin()
  await setCoreRetired(createAdminClient(), questionId, retired)
  await log(user.id, retired ? 'core.retire' : 'core.restore', { question_id: questionId })
  revalidate()
  return { ok: true }
}

export async function moveCore(questionId: string, direction: 'up' | 'down'): Promise<ActionResult> {
  await requireAcademyAdmin()
  if (direction !== 'up' && direction !== 'down') return fail('Unknown direction.')
  await moveCoreQuestion(createAdminClient(), questionId, direction)
  revalidate()
  return { ok: true }
}
