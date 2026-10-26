import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(() => {
  process.env.SURVEYS_SECRET = 'test-secret-test-secret-test-secret-123'
})

describe('personal-link tokens', () => {
  it('gives each participant a stable, URL-safe token, stored only as a SHA-256 hash', async () => {
    const { participantToken, hashToken } = await import('./tokens')
    const a = participantToken('11111111-1111-1111-1111-111111111111')
    expect(a).toBe(participantToken('11111111-1111-1111-1111-111111111111'))
    expect(a).not.toBe(participantToken('22222222-2222-2222-2222-222222222222'))
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('device cookie', () => {
  it('round-trips a person id and rejects tampering', async () => {
    const { signPerson, verifyPerson } = await import('./tokens')
    const value = signPerson('person-1')
    expect(verifyPerson(value)).toBe('person-1')
    expect(verifyPerson(value.replace('person-1', 'person-2'))).toBeNull()
    expect(verifyPerson(`${value}x`)).toBeNull()
    expect(verifyPerson('no-signature')).toBeNull()
    expect(verifyPerson(undefined)).toBeNull()
  })
})
