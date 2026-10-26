// Pure: rows → CSV text (RFC 4180 quoting, CRLF lines, UTF-8 BOM so Excel reads accents).
// Cells starting with = + - @ get a leading apostrophe: participants' answers end up in
// these files, and a spreadsheet would otherwise run them as formulas.
const FORMULA = /^[=+\-@\t\r]/

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  if (typeof value === 'string' && FORMULA.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
