// Runs under Vitest (Node), not Deno: WordPress title clean-up for the sync and the Catalogue page.
import { describe, expect, it } from 'vitest'
import { decodeEntities, wpTitleText } from './wp-text.ts'

describe('decodeEntities', () => {
  it('decodes the entities WordPress puts in titles', () => {
    expect(decodeEntities('Climate &#038; Community Resilience')).toBe('Climate & Community Resilience')
    expect(decodeEntities('Webinar &#8211; Part 2')).toBe('Webinar – Part 2')
    expect(decodeEntities('&#8220;Why?&#8221; and &ldquo;How?&rdquo;')).toBe('“Why?” and “How?”')
    expect(decodeEntities('Coastal Processes &amp; Morphology')).toBe('Coastal Processes & Morphology')
    expect(decodeEntities('Bj&oslash;rn&#x27;s')).toBe("Bjørn's")
  })
  it('leaves unknown names and plain text alone', () => {
    expect(decodeEntities('A &madeup; name')).toBe('A &madeup; name')
    expect(decodeEntities('R&D')).toBe('R&D')
  })
})

describe('wpTitleText', () => {
  it('strips tags, decodes and tidies spaces', () => {
    expect(wpTitleText('  <em>Ocean</em>  Literacy &#8211; self paced ')).toBe('Ocean Literacy – self paced')
    expect(wpTitleText(undefined)).toBe('')
  })
})
