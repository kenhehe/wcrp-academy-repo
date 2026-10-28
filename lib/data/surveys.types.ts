// Row types for the survey tables (supabase/migrations/20261026_survey_module.sql).
// No database access here, so client components can import it.

export const SURVEY_STATUSES     = ['draft', 'active', 'closed'] as const
export const QUESTION_TYPES      = ['likert_5', 'single_choice', 'multi_choice', 'knowledge_mcq', 'text'] as const
export const QUESTION_STAGES     = ['pre', 'post', 'both'] as const
export const SUBMISSION_STAGES   = ['pre', 'post'] as const
export const SUBMISSION_CHANNELS = ['email_link', 'qr_cookie', 'qr_email'] as const
export const SUBMISSION_STATUSES = ['accepted', 'flagged_duplicate'] as const
export const PARTICIPANT_SOURCES = ['imported', 'walk_in'] as const
export const EMAIL_KINDS         = ['invite_pre', 'reminder_pre', 'confirmation', 'invite_post', 'reminder_post'] as const
export const EMAIL_JOB_STATUSES  = ['scheduled', 'sending', 'done', 'cancelled'] as const
export const EMAIL_LOG_STATUSES  = ['sent', 'failed', 'bounced'] as const

export type SurveyStatus       = typeof SURVEY_STATUSES[number]
export type QuestionType       = typeof QUESTION_TYPES[number]
export type QuestionStage      = typeof QUESTION_STAGES[number]
export type SubmissionStage    = typeof SUBMISSION_STAGES[number]
export type SubmissionChannel  = typeof SUBMISSION_CHANNELS[number]
export type SubmissionStatus   = typeof SUBMISSION_STATUSES[number]
export type ParticipantSource  = typeof PARTICIPANT_SOURCES[number]
export type EmailKind          = typeof EMAIL_KINDS[number]
export type EmailJobStatus     = typeof EMAIL_JOB_STATUSES[number]
export type EmailLogStatus     = typeof EMAIL_LOG_STATUSES[number]

// Timestamps are ISO strings as PostgREST returns them

export interface SurveyPersonRow {
  id:              string
  email:           string | null   // null once the retention job has purged it
  pseudonym:       string          // 'P-7F3K'
  email_purged_at: string | null
  created_at:      string
  updated_at:      string
}

export interface SurveyEventRow {
  id:               string
  academy_event_id: string | null   // null: a stand-alone survey with no event
  slug:             string
  title:            string
  event_starts_at:  string | null
  event_ends_at:    string | null
  pre_opens_at:     string | null
  pre_closes_at:    string | null
  post_opens_at:    string | null
  post_closes_at:   string | null
  status:           SurveyStatus
  created_by:       string | null
  created_at:       string
  updated_at:       string
}

export interface SurveyQuestionRow {
  id:         string
  key:        string   // 'core.understanding'
  is_core:    boolean
  type:       QuestionType
  stage:      QuestionStage
  in_bank:    boolean
  core_order: number | null   // core questions: position in a new survey
  retired_at: string | null   // core questions: new surveys stop asking it
  created_at: string
  updated_at: string
}

export interface SurveyQuestionVersionRow {
  id:              string
  question_id:     string
  version:         number
  text:            string
  options:         string[] | null   // choice labels, in order
  scale_min_label: string | null     // likert_5: what 1 means
  scale_max_label: string | null     // likert_5: what 5 means
  correct_option:  string | null     // knowledge_mcq only
  is_required:     boolean
  created_at:      string
}

export interface SurveyEventQuestionRow {
  survey_event_id:     string
  question_version_id: string
  stage:               QuestionStage
  sort_order:          number
}

export interface SurveyEventParticipantRow {
  id:              string
  survey_event_id: string
  person_id:       string
  token_hash:      string   // SHA-256 hex of the personal-link token
  source:          ParticipantSource
  created_at:      string
  updated_at:      string
}

export interface SurveySubmissionRow {
  id:                   string
  event_participant_id: string
  stage:                SubmissionStage
  channel:              SubmissionChannel
  status:               SubmissionStatus
  submitted_at:         string
  created_at:           string
  updated_at:           string
}

export interface SurveyAnswerRow {
  id:                  string
  submission_id:       string
  question_version_id: string
  value_number:        number | null
  value_text:          string | null
  value_choices:       string[] | null
  created_at:          string
}

export interface SurveyEmailJobRow {
  id:              string
  survey_event_id: string
  kind:            EmailKind
  rule:            string | null   // 'post_open_plus_1h'; null for "send now"
  scheduled_at:    string
  status:          EmailJobStatus
  created_at:      string
  updated_at:      string
}

export interface SurveyEmailLogRow {
  id:                   string
  job_id:               string | null
  event_participant_id: string
  kind:                 EmailKind
  status:               EmailLogStatus
  error:                string | null
  sent_at:              string
}

export interface SurveyMergeRow {
  id:               string
  kept_person_id:   string
  merged_person_id: string
  merged_by:        string | null
  merged_at:        string
}

export interface SurveyAdminLogRow {
  id:              string
  actor_id:        string | null
  action:          string
  survey_event_id: string | null
  detail:          Record<string, unknown>
  created_at:      string
}

// ─── Labels ────────────────────────────────────────────────────────────────────

// Shown before the questions (draft wording, docs/surveys/PLAN.md section 8)
export const SURVEY_CONSENT =
  'Your answers help the WCRP Academy understand the impact of its events. Answers are analysed anonymously and used only by the Academy. Your email is used only to send you survey links and is deleted 24 months after the event.'

export const SURVEY_STATUS_LABELS: Record<SurveyStatus, string> = {
  draft:  'Draft',
  active: 'Active',
  closed: 'Closed',
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  likert_5:      'Scale 1–5',
  single_choice: 'One choice',
  multi_choice:  'Several choices',
  knowledge_mcq: 'Quiz question',
  text:          'Short text',
}

export const QUESTION_STAGE_LABELS: Record<QuestionStage, string> = {
  both: 'Before and after',
  pre:  'Before only',
  post: 'After only',
}

// Types an admin can pick for an event's own questions (quiz questions come later)
export const EDITABLE_QUESTION_TYPES = ['likert_5', 'single_choice', 'multi_choice', 'text'] as const
export type EditableQuestionType = typeof EDITABLE_QUESTION_TYPES[number]

// ─── Inputs (client → server actions) ──────────────────────────────────────────

// What a survey action returns: expected problems (a clash, a lock, bad input) come back as
// `error` for a toast; unexpected failures (a query error) throw instead.
export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string }

export interface QuestionInput {
  text:          string
  type:          EditableQuestionType
  stage:         QuestionStage
  options:       string[]   // choice types only
  scaleMinLabel: string     // likert_5 only
  scaleMaxLabel: string
  isRequired:    boolean
}

// ISO instants; the browser converts the admin's local times before sending
// The four windows. The event's own dates come from the Academy catalogue; the survey's
// event_starts_at / event_ends_at columns are no longer written (kept from before 2026-10-27).
export interface SurveyTimesInput {
  preOpensAt:    string
  preClosesAt:   string
  postOpensAt:   string
  postClosesAt:  string
}

export interface SurveyDetailsInput extends SurveyTimesInput {
  title: string
}

export interface NewSurveyInput extends SurveyDetailsInput {
  academyEventId: string | null   // null: a stand-alone survey with no event
  questions:      QuestionInput[]
}

// ─── Views (loaders → pages) ───────────────────────────────────────────────────

export interface SurveyProgress {
  participants: number
  pre:          number          // accepted before-survey answers
  post:         number
  matched:      number          // answered both
  flagged:      number          // flagged duplicates waiting for review
  matchRate:    number | null   // matched ÷ pre, 0–1; null until someone answers before
}

// A question as one survey asks it
export interface SurveyQuestionItem {
  versionId:     string
  questionId:    string
  key:           string
  isCore:        boolean
  type:          QuestionType
  stage:         QuestionStage
  sortOrder:     number
  version:       number
  text:          string
  options:       string[] | null
  scaleMinLabel: string | null
  scaleMaxLabel: string | null
  isRequired:    boolean
}

export interface SurveyAcademyEvent {
  id:             string
  academy_id:     string | null   // the WordPress post id
  title:          string
  status:         string | null
  publish_date:   string | null
  training_type:  string | null
  lead_organizer: string | null
  delivery_mode:  string | null
  location:       string | null
  start_date:     string | null
  end_date:       string | null
  permalink:      string | null
}

export interface SurveyListItem {
  id:            string
  slug:          string
  title:         string
  status:        SurveyStatus
  eventTitle:    string | null   // null: a stand-alone survey
  trainingType:  string | null
  preOpensAt:    string | null
  postOpensAt:   string | null
  postClosesAt:  string | null
  afterOpen:     boolean   // the after-survey has opened (until then there's no match rate)
  progress:      SurveyProgress
}

export interface SurveyDetail {
  survey:       SurveyEventRow
  academyEvent: SurveyAcademyEvent | null
  questions:    SurveyQuestionItem[]
  progress:     SurveyProgress
  locked:       boolean   // someone has answered: questions can't change
  afterOpen:    boolean   // the after-survey has opened
}

// One Academy catalogue event in the New survey picker
export interface CatalogueOption {
  id:           string
  title:        string
  trainingType: string | null
  organiser:    string | null
  deliveryMode: string | null
  startDate:    string | null   // a day, '2026-11-18'
  endDate:      string | null
  status:       string          // resolveStatus(): 'On Demand' has no start or end
  hasSurvey:    boolean
}
