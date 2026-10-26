import { describe, expect, it } from 'vitest'
import { csvCell, toCsv } from './csv'

describe('csv', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a, b')).toBe('"a, b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
    expect(csvCell(null)).toBe('')
    expect(csvCell(4)).toBe('4')
  })

  it('defuses text that a spreadsheet would run as a formula', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"')
    expect(csvCell('+1 more')).toBe("'+1 more")
    expect(csvCell(-3)).toBe('-3')
  })

  it('joins rows with CRLF behind a BOM', () => {
    expect(toCsv([['a', 'b'], [1, null]])).toBe('﻿a,b\r\n1,\r\n')
  })
})
