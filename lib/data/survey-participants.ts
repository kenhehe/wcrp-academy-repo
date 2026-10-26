// Pure helpers for survey participants: reading pasted or CSV email lists, typo hints,
// masking an email for "Continue as…", and each participant's status.
import type { EmailKind, EmailLogStatus, ParticipantSource, SubmissionStage, SubmissionStatus } from './surveys.types'

// Simple and strict enough for a mailing list: one @, a dot in the domain, no spaces
const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/
const EMAIL_IN_TEXT = /[^\s,;:<>"'()[\]]+@[^\s,;:<>"'()[\]]+\.[^\s,;:<>"'()[\]]+/g

export function normalizeEmail(email: string): string {
  return email.trim().replace(/^mailto:/i, '').toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL.test(email)
}

// Splits pasted text into entries: one per line, or separated by commas / semicolons /
// tabs. "Name <a@b.org>" keeps just the address.
export function splitEmailList(text: string): string[] {
  return text
    .split(/[\n\r,;\t]+/)
    .map(part => {
      const angle = /<([^>]+)>/.exec(part)
      return (angle ? angle[1] : part).trim().replace(/^"+|"+$/g, '')
    })
    .filter(Boolean)
}

// A CSV such as a Zoom registration export: takes the column whose header mentions "email";
// without one, every cell that looks like an address
export function emailsFromCsv(text: string): string[] {
  const rows = text.split(/\r?\n/).filter(r => r.trim())
  if (rows.length === 0) return []
  const cells = (row: string) => row.split(/[,;\t](?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''))
  const header = cells(rows[0]).map(c => c.toLowerCase())
  const column = header.findIndex(h => h.includes('email') || h.includes('e-mail'))
  if (column >= 0) return rows.slice(1).map(r => cells(r)[column] ?? '').filter(Boolean)
  return text.match(EMAIL_IN_TEXT) ?? []
}

export interface CleanedEmails {
  valid:    string[]   // normalised, each once
  invalid:  string[]   // as typed
  repeated: number     // entries dropped because they appeared earlier in the list
}

export function cleanEmailList(entries: string[]): CleanedEmails {
  const seen = new Set<string>()
  const valid: string[] = [], invalid: string[] = []
  let repeated = 0
  for (const entry of entries) {
    const email = normalizeEmail(entry)
    if (!email) continue
    if (!isValidEmail(email)) { invalid.push(entry.trim()); continue }
    if (seen.has(email)) { repeated++; continue }
    seen.add(email)
    valid.push(email)
  }
  return { valid, invalid, repeated }
}

// Common domain typos, in the spirit of mailcheck: 'k@gmial.com' → 'k@gmail.com'
const DOMAIN_FIXES: Record<string, string> = {
  'gmial.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmai.com': 'gmail.com', 'gnail.com': 'gmail.com',
  'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmail.co': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com', 'outlook.co': 'outlook.com',
  'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.co': 'yahoo.com',
  'icloud.co': 'icloud.com', 'iclod.com': 'icloud.com',
}

export function suggestEmailFix(email: string): string | null {
  const normalized = normalizeEmail(email)
  const at = normalized.lastIndexOf('@')
  if (at <= 0) return null
  const fix = DOMAIN_FIXES[normalized.slice(at + 1)]
  return fix ? `${normalized.slice(0, at + 1)}${fix}` : null
}

// 'k.ramirez@gmail.com' → 'k•••@gmail.com'
export function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) return '•••'
  return `${email[0]}•••${email.slice(at)}`
}

// ─── Status ───────────────────────────────────────────────────────────────────

export type ParticipantState = 'not_started' | 'invited' | 'before_only' | 'after_only' | 'matched'

export const PARTICIPANT_STATE_LABELS: Record<ParticipantState, string> = {
  not_started: 'Not started',
  invited:     'Invited',
  before_only: 'Answered before',
  after_only:  'After only',
  matched:     'Matched',
}

export interface ParticipantFacts {
  source:      ParticipantSource
  submissions: { stage: SubmissionStage; status: SubmissionStatus }[]
  emails:      { kind: EmailKind; status: EmailLogStatus }[]
}

export interface ParticipantStatus {
  state:   ParticipantState
  walkIn:  boolean
  bounced: boolean   // an email to them bounced or failed
  flagged: number    // repeat answers waiting for review
}

// One row of the Participants tab: email and status, never answers
export interface ParticipantListItem {
  id:           string
  personId:     string
  email:        string | null   // null once the retention job has purged it
  source:       ParticipantSource
  status:       ParticipantStatus
  lastActivity: { label: string; at: string } | null
}

export const EMAIL_KIND_LABELS: Record<EmailKind, string> = {
  invite_pre:    'Before-survey invite',
  reminder_pre:  'Before-survey reminder',
  confirmation:  'Thank-you with after link',
  invite_post:   'After-survey invite',
  reminder_post: 'After-survey reminder',
}

export function participantStatus(f: ParticipantFacts): ParticipantStatus {
  const accepted = new Set(f.submissions.filter(s => s.status === 'accepted').map(s => s.stage))
  const state: ParticipantState =
    accepted.has('pre') && accepted.has('post') ? 'matched'
    : accepted.has('pre')  ? 'before_only'
    : accepted.has('post') ? 'after_only'
    : f.emails.some(e => e.status === 'sent') ? 'invited'
    : 'not_started'
  return {
    state,
    walkIn:  f.source === 'walk_in',
    bounced: f.emails.some(e => e.status !== 'sent'),
    flagged: f.submissions.filter(s => s.status === 'flagged_duplicate').length,
  }
}
