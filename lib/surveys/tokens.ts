// Server only (uses SURVEYS_SECRET). Personal-link tokens and the signed device cookie.
//
// A participant's token is derived from their id with an HMAC, so the same personal link can
// be shown again or re-sent without storing it; the database keeps only its SHA-256
// (survey_event_participants.token_hash) to look the participant up. Anyone holding the
// secret could rebuild every link, so it lives only in env vars (.env.local and Vercel).
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

function secret(): string {
  const value = process.env.SURVEYS_SECRET
  if (!value || value.length < 32) throw new Error('SURVEYS_SECRET is missing or shorter than 32 characters (set it in .env.local and on Vercel)')
  return value
}

const hmac = (purpose: string, id: string) => createHmac('sha256', secret()).update(`${purpose}:${id}`).digest('base64url')

export function participantToken(participantId: string): string {
  return hmac('participant', participantId)
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export const PERSON_COOKIE = 'wcrp_survey_person'

// Cookie value: "<personId>.<signature>". Holds nothing but the id.
export function signPerson(personId: string): string {
  return `${personId}.${hmac('person', personId)}`
}

export function verifyPerson(value: string | undefined): string | null {
  if (!value) return null
  const dot = value.lastIndexOf('.')
  if (dot <= 0) return null
  const personId = value.slice(0, dot)
  const given = Buffer.from(value.slice(dot + 1))
  const expected = Buffer.from(hmac('person', personId))
  return given.length === expected.length && timingSafeEqual(given, expected) ? personId : null
}
