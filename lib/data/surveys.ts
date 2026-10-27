// Loaders for the survey admin pages. Survey tables have RLS with no policies (service role
// only), so every loader checks the Academy admin role, then reads with the admin client.
// Plain helpers that take a client (fetchCoreQuestions, fetchSurveyQuestions, isSurveyLocked)
// are shared with the server actions.
import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAcademyAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { must } from '@/lib/supabase/must'
import { resolveStatus } from './academy-events.types'
import { emptyProgress, progressBySurvey, type ParticipantRef, type SubmissionRef } from './survey-progress'
import { EMAIL_KIND_LABELS, participantStatus, type ParticipantListItem } from './survey-participants'
import { buildResults, type ResultAnswer, type SurveyResults } from './survey-results'
import {
  type CatalogueOption, type EmailKind, type EmailLogStatus, type ParticipantSource, type QuestionStage,
  type QuestionType, type SubmissionStage, type SubmissionStatus, type SurveyAcademyEvent,
  type SurveyDetail, type SurveyEventRow, type SurveyListItem, type SurveyQuestionItem,
} from './surveys.types'

interface QuestionVersionJoin {
  id:              string
  version:         number
  text:            string
  options:         string[] | null
  scale_min_label: string | null
  scale_max_label: string | null
  is_required:     boolean
  survey_questions: { id: string; key: string; is_core: boolean; type: QuestionType; stage: QuestionStage }
}

const hasOpened = (iso: string | null) => iso !== null && new Date(iso).getTime() <= Date.now()

const VERSION_SELECT ='id,version,text,options,scale_min_label,scale_max_label,is_required,survey_questions(id,key,is_core,type,stage)'

function toItem(v: QuestionVersionJoin, stage: QuestionStage, sortOrder: number): SurveyQuestionItem {
  return {
    versionId:     v.id,
    questionId:    v.survey_questions.id,
    key:           v.survey_questions.key,
    isCore:        v.survey_questions.is_core,
    type:          v.survey_questions.type,
    stage,
    sortOrder,
    version:       v.version,
    text:          v.text,
    options:       v.options,
    scaleMinLabel: v.scale_min_label,
    scaleMaxLabel: v.scale_max_label,
    isRequired:    v.is_required,
  }
}

// The latest version of each core question that isn't retired, in core order (what a new
// survey asks; the order and retiring are managed on the Core questions page)
export async function fetchCoreQuestions(db: SupabaseClient): Promise<SurveyQuestionItem[]> {
  // The client is untyped, so joined rows are cast to their known shape
  const rows = must('core questions query', await db
    .from('survey_question_versions')
    .select(VERSION_SELECT.replace('survey_questions(id,key,is_core,type,stage)', 'survey_questions!inner(id,key,is_core,type,stage,core_order)'))
    .eq('survey_questions.is_core', true)
    .is('survey_questions.retired_at', null)
    .order('version', { ascending: false })) as unknown as (QuestionVersionJoin & { survey_questions: { core_order: number | null } })[]

  const latest = new Map<string, (typeof rows)[number]>()
  for (const v of rows) if (!latest.has(v.survey_questions.key)) latest.set(v.survey_questions.key, v)

  const rank = (v: (typeof rows)[number]) => v.survey_questions.core_order ?? Number.MAX_SAFE_INTEGER
  return [...latest.values()]
    .sort((a, b) => rank(a) - rank(b) || a.survey_questions.key.localeCompare(b.survey_questions.key))
    .map((v, i) => toItem(v, v.survey_questions.stage, i))
}

// The questions one survey asks, in order
export async function fetchSurveyQuestions(db: SupabaseClient, surveyId: string): Promise<SurveyQuestionItem[]> {
  const rows = must('survey questions query', await db
    .from('survey_event_questions')
    .select(`stage,sort_order,survey_question_versions(${VERSION_SELECT})`)
    .eq('survey_event_id', surveyId)
    .order('sort_order')) as unknown as { stage: QuestionStage; sort_order: number; survey_question_versions: QuestionVersionJoin }[]
  return rows.map(r => toItem(r.survey_question_versions, r.stage, r.sort_order))
}

// True once anyone has answered (accepted or flagged): the questions are then fixed
export async function isSurveyLocked(db: SupabaseClient, surveyId: string): Promise<boolean> {
  const rows = must('survey lock query', await db
    .from('survey_submissions')
    .select('id,survey_event_participants!inner(survey_event_id)')
    .eq('survey_event_participants.survey_event_id', surveyId)
    .limit(1))
  return (rows ?? []).length > 0
}

async function fetchProgressRefs(db: SupabaseClient, surveyId?: string) {
  const participants = await fetchAllRows<ParticipantRef>('survey participants query', (from, to) => {
    let q = db.from('survey_event_participants').select('id,survey_event_id')
    if (surveyId) q = q.eq('survey_event_id', surveyId)
    return q.order('id').range(from, to)
  })
  const submissions = await fetchAllRows<SubmissionRef>('survey submissions query', (from, to) => {
    let q = db.from('survey_submissions').select('event_participant_id,stage,status,survey_event_participants!inner(survey_event_id)')
    if (surveyId) q = q.eq('survey_event_participants.survey_event_id', surveyId)
    return q.order('id').range(from, to)
  })
  return progressBySurvey(participants, submissions)
}

export const getSurveyList = cache(async (): Promise<SurveyListItem[]> => {
  await requireAcademyAdmin()
  const db = createAdminClient()
  const [surveys, progress] = await Promise.all([
    db.from('survey_events')
      .select('id,slug,title,status,pre_opens_at,post_opens_at,post_closes_at,created_at,academy_events(title,training_type)')
      .order('created_at', { ascending: false })
      .then(res => must('surveys query', res) as unknown as (Pick<SurveyEventRow, 'id' | 'slug' | 'title' | 'status' | 'pre_opens_at' | 'post_opens_at' | 'post_closes_at'>
        & { academy_events: { title: string; training_type: string | null } | null })[]),
    fetchProgressRefs(db),
  ])
  return surveys.map(s => ({
    id:           s.id,
    slug:         s.slug,
    title:        s.title,
    status:       s.status,
    eventTitle:   s.academy_events?.title ?? null,
    trainingType: s.academy_events?.training_type ?? null,
    preOpensAt:   s.pre_opens_at,
    postOpensAt:  s.post_opens_at,
    postClosesAt: s.post_closes_at,
    afterOpen:    hasOpened(s.post_opens_at),
    progress:     progress.get(s.id) ?? emptyProgress(),
  }))
})

export const getSurveyBySlug = cache(async (slug: string): Promise<SurveyDetail | null> => {
  await requireAcademyAdmin()
  const db = createAdminClient()
  const row = must('survey query', await db
    .from('survey_events')
    .select('*,academy_events(id,academy_id,title,status,training_type,lead_organizer,delivery_mode,location,start_date,end_date,publish_date,permalink)')
    .eq('slug', slug)
    .maybeSingle()) as unknown as (SurveyEventRow & { academy_events: SurveyAcademyEvent | null }) | null
  if (!row) return null

  const { academy_events: academyEvent, ...survey } = row
  const [questions, progress, locked] = await Promise.all([
    fetchSurveyQuestions(db, survey.id),
    fetchProgressRefs(db, survey.id),
    isSurveyLocked(db, survey.id),
  ])
  return {
    survey, academyEvent, questions, locked,
    progress:  progress.get(survey.id) ?? emptyProgress(),
    afterOpen: hasOpened(survey.post_opens_at),
  }
})

export const getCoreQuestions = cache(async (): Promise<SurveyQuestionItem[]> => {
  await requireAcademyAdmin()
  return fetchCoreQuestions(createAdminClient())
})

// Every Academy catalogue event for the New survey picker, marking the ones that already have a survey
export const getCatalogueOptions = cache(async (): Promise<CatalogueOption[]> => {
  await requireAcademyAdmin()
  const db = createAdminClient()
  const [events, taken] = await Promise.all([
    fetchAllRows<{ id: string; title: string; status: string | null; training_type: string | null; lead_organizer: string | null; delivery_mode: string | null; start_date: string | null; end_date: string | null; publish_date: string | null }>(
      'academy events query',
      (from, to) => db.from('academy_events')
        .select('id,title,status,training_type,lead_organizer,delivery_mode,start_date,end_date,publish_date')
        .order('title').order('id').range(from, to),
    ),
    db.from('survey_events').select('academy_event_id')
      .then(res => new Set((must('surveyed events query', res) ?? []).map(r => r.academy_event_id as string))),
  ])
  return events.map(e => ({
    id:           e.id,
    title:        e.title,
    trainingType: e.training_type,
    organiser:    e.lead_organizer,
    deliveryMode: e.delivery_mode,
    startDate:    e.start_date,
    endDate:      e.end_date,
    status:       resolveStatus(e),
    hasSurvey:    taken.has(e.id),
  }))
})

// Everyone in one survey with their status (Participants tab). Emails and statuses only:
// this loader never reads answers.
export const getSurveyParticipants = cache(async (surveyId: string): Promise<ParticipantListItem[]> => {
  await requireAcademyAdmin()
  const db = createAdminClient()
  const [participants, submissions, emails] = await Promise.all([
    fetchAllRows(
      'participants query',
      (from, to) => db.from('survey_event_participants')
        .select('id,person_id,source,created_at,survey_people(email)')
        .eq('survey_event_id', surveyId).order('created_at').order('id').range(from, to),
    ).then(rows => rows as unknown as { id: string; person_id: string; source: ParticipantSource; created_at: string; survey_people: { email: string | null } | null }[]),
    fetchAllRows<{ event_participant_id: string; stage: SubmissionStage; status: SubmissionStatus; submitted_at: string }>(
      'participant submissions query',
      (from, to) => db.from('survey_submissions')
        .select('event_participant_id,stage,status,submitted_at,survey_event_participants!inner(survey_event_id)')
        .eq('survey_event_participants.survey_event_id', surveyId).order('id').range(from, to),
    ),
    fetchAllRows<{ event_participant_id: string; kind: EmailKind; status: EmailLogStatus; sent_at: string }>(
      'participant emails query',
      (from, to) => db.from('survey_email_log')
        .select('event_participant_id,kind,status,sent_at,survey_event_participants!inner(survey_event_id)')
        .eq('survey_event_participants.survey_event_id', surveyId).order('id').range(from, to),
    ),
  ])

  const group = <T extends { event_participant_id: string }>(rows: T[]) => {
    const map = new Map<string, T[]>()
    for (const r of rows) map.set(r.event_participant_id, [...(map.get(r.event_participant_id) ?? []), r])
    return map
  }
  const subsBy = group(submissions), emailsBy = group(emails)

  return participants.map(p => {
    const subs = subsBy.get(p.id) ?? [], sent = emailsBy.get(p.id) ?? []
    const events = [
      ...subs.map(s => ({ at: s.submitted_at, label: `Answered ${s.stage === 'pre' ? 'before' : 'after'}${s.status === 'flagged_duplicate' ? ' again (flagged)' : ''}` })),
      ...sent.map(e => ({ at: e.sent_at, label: `${EMAIL_KIND_LABELS[e.kind]} ${e.status}` })),
    ].sort((a, b) => b.at.localeCompare(a.at))
    return {
      id:           p.id,
      personId:     p.person_id,
      email:        p.survey_people?.email ?? null,
      source:       p.source,
      status:       participantStatus({ source: p.source, submissions: subs, emails: sent }),
      lastActivity: events[0] ?? null,
    }
  })
})

// Accepted answers of one survey, keyed by participant (pseudonyms only: this loader never
// reads an email address). Feeds the Results tab and the answers export.
export async function fetchAcceptedAnswers(db: SupabaseClient, surveyId: string): Promise<ResultAnswer[]> {
  const rows = await fetchAllRows('survey answers query', (from, to) => db.from('survey_answers')
    .select('question_version_id,value_number,value_text,value_choices,survey_submissions!inner(event_participant_id,stage,status,survey_event_participants!inner(survey_event_id))')
    .eq('survey_submissions.status', 'accepted')
    .eq('survey_submissions.survey_event_participants.survey_event_id', surveyId)
    .order('id').range(from, to)) as unknown as {
      question_version_id: string; value_number: number | null; value_text: string | null; value_choices: string[] | null
      survey_submissions: { event_participant_id: string; stage: SubmissionStage }
    }[]
  return rows.map(r => ({
    participantId: r.survey_submissions.event_participant_id,
    stage:         r.survey_submissions.stage,
    versionId:     r.question_version_id,
    number:        r.value_number === null ? null : Number(r.value_number),
    text:          r.value_text,
    choices:       r.value_choices,
  }))
}

export async function fetchPseudonyms(db: SupabaseClient, surveyId: string): Promise<Map<string, string>> {
  const rows = await fetchAllRows('pseudonyms query', (from, to) => db.from('survey_event_participants')
    .select('id,survey_people(pseudonym)').eq('survey_event_id', surveyId).order('id').range(from, to)) as unknown as
    { id: string; survey_people: { pseudonym: string } | null }[]
  return new Map(rows.map(r => [r.id, r.survey_people?.pseudonym ?? '?']))
}

export const getSurveyResults = cache(async (surveyId: string): Promise<SurveyResults> => {
  await requireAcademyAdmin()
  const db = createAdminClient()
  const [questions, pseudonyms, answers] = await Promise.all([
    fetchSurveyQuestions(db, surveyId),
    fetchPseudonyms(db, surveyId),
    fetchAcceptedAnswers(db, surveyId),
  ])
  return buildResults(questions, pseudonyms, answers)
})
