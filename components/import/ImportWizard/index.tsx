'use client'

import { useReducer, useRef, useTransition } from 'react'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { importEvents } from '@/app/dashboard/ipo/import/actions'
import type { MappedRow } from '@/app/dashboard/ipo/import/actions'
import type {
  WizardState,
  WizardAction,
  ParsedRow,
  EventField,
} from './types'
import {
  INITIAL_STATE,
  EVENT_FIELD_LABELS,
} from './types'

// ── Auto-detect column mappings from common header names ──────────────────────
const FIELD_ALIASES: Record<EventField, string[]> = {
  title:      ['title', 'event title', 'event name', 'name', 'event'],
  start_date: ['start date', 'start_date', 'date', 'begin date', 'from', 'start'],
  end_date:   ['end date', 'end_date', 'to', 'finish date', 'end', 'until'],
  status:     ['status', 'state'],
  location:   ['location', 'venue', 'city', 'place'],
  country:    ['country', 'nation'],
  url:        ['url', 'link', 'website', 'web', 'href'],
  source:     ['source', 'origin'],
  extra:      [],
  skip:       [],
}

function autoDetect(headers: string[]): Record<string, EventField> {
  const map: Record<string, EventField> = {}
  for (const h of headers) {
    const lower = h.toLowerCase().trim()
    let matched: EventField = 'extra'
    for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [EventField, string[]][]) {
      if (field === 'extra' || field === 'skip') continue
      if (aliases.includes(lower)) { matched = field; break }
    }
    map[h] = matched
  }
  return map
}

// ── Reducer ───────────────────────────────────────────────────────────────────
function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_FILE':
      return {
        ...state,
        step: 'map',
        fileName: action.fileName,
        rawHeaders: action.headers,
        rawRows: action.rows,
        columnMap: autoDetect(action.headers),
        error: null,
      }
    case 'SET_COL':
      return { ...state, columnMap: { ...state.columnMap, [action.header]: action.field } }
    case 'GO_TO_PREVIEW':
      return { ...state, step: 'preview', error: null }
    case 'START_IMPORT':
      return { ...state, step: 'importing', error: null }
    case 'SET_RESULT':
      return { ...state, step: 'done', result: action.result }
    case 'SET_ERROR':
      return { ...state, step: state.step === 'importing' ? 'preview' : state.step, error: action.error }
    case 'RESET':
      return INITIAL_STATE
    default:
      return state
  }
}

// ── Date helpers (shared with Academy wizard) ─────────────────────────────────
const MONTH_ABBR: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

function dateToISO(d: Date): string {
  const y   = d.getUTCFullYear()
  const m   = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function normalizeDate(raw: string): string {
  if (!raw) return ''
  const s = raw.trim()
  if (!s || s.toLowerCase() === 'none' || s.toLowerCase() === 'n/a') return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // DD-Mon-YY or DD-Mon-YYYY  (e.g. "12-Mar-25", "12-Mar-2025")
  const dmy = s.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{2,4})$/)
  if (dmy) {
    const [, d, mon, yr] = dmy
    const month = MONTH_ABBR[mon.toLowerCase()]
    if (month) {
      const year = yr.length === 2 ? (parseInt(yr) < 50 ? `20${yr}` : `19${yr}`) : yr
      return `${year}-${month}-${d.padStart(2, '0')}`
    }
  }
  const cleaned = s.replace(/\s*(GMT|UTC)[+-]\d{2,4}.*/i, '').trim()
  const dt = new Date(cleaned)
  if (!isNaN(dt.getTime())) return dateToISO(dt)
  return s
}

// ── Parse file via xlsx ───────────────────────────────────────────────────────
async function parseFile(file: File): Promise<{ headers: string[]; rows: ParsedRow[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: '',
        }) as unknown[][]

        if (!raw.length) { resolve({ headers: [], rows: [] }); return }

        const headers = (raw[0] as string[]).map(String)
        const rows = raw.slice(1).map(row =>
          Object.fromEntries(headers.map((h, i) => {
            const val = (row as unknown[])[i]
            // XLSX converts date cells to JS Date objects when cellDates: true.
            // String(date) produces timezone-laden strings Postgres rejects.
            const str = val instanceof Date ? dateToISO(val) : String(val ?? '')
            return [h, str]
          }))
        ) as ParsedRow[]
        resolve({ headers, rows })
      } catch (err) {
        reject(new Error(`Failed to parse file: ${(err as Error).message}`))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

const IPO_DATE_FIELDS = new Set<EventField>(['start_date', 'end_date'])

// ── Build MappedRows from raw rows + column map ───────────────────────────────
function buildMappedRows(rawRows: ParsedRow[], columnMap: Record<string, EventField>): MappedRow[] {
  return rawRows
    .map(row => {
      const mapped: Partial<MappedRow> & { extra_fields: Record<string, string> } = {
        extra_fields: {},
      }
      for (const [header, field] of Object.entries(columnMap)) {
        const val = row[header]?.trim() ?? ''
        if (!val || field === 'skip') continue
        if (field === 'extra') {
          mapped.extra_fields![header] = val
        } else {
          (mapped as Record<string, unknown>)[field] = IPO_DATE_FIELDS.has(field)
            ? normalizeDate(val)
            : val
        }
      }
      return mapped as MappedRow
    })
    .filter(r => r.title && r.start_date)
}

// ── Validation ────────────────────────────────────────────────────────────────
function isMappingValid(columnMap: Record<string, EventField>): { ok: boolean; missing: string[] } {
  const mapped = Object.values(columnMap)
  const missing: string[] = []
  if (!mapped.includes('title'))      missing.push('Title')
  if (!mapped.includes('start_date')) missing.push('Start Date')
  return { ok: missing.length === 0, missing }
}

// ── Step components ───────────────────────────────────────────────────────────

function StepUpload({ onFile, error }: { onFile: (f: File) => void; error: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border p-16 cursor-pointer hover:border-primary/60 hover:bg-muted/30 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
        <div className="text-center">
          <p className="text-sm font-medium">Drop your file here, or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">Supports CSV, XLSX, XLS</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

function StepMap({
  headers,
  columnMap,
  onColChange,
  onBack,
  onNext,
}: {
  headers: string[]
  columnMap: Record<string, EventField>
  onColChange: (header: string, field: EventField) => void
  onBack: () => void
  onNext: () => void
}) {
  const { ok, missing } = isMappingValid(columnMap)
  const allFields = Object.keys(EVENT_FIELD_LABELS) as EventField[]

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Map each column from your file to an event field. Columns marked as{' '}
        <span className="font-medium">Extra field</span> will be stored in your custom fields.
      </p>

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground w-1/2">File column</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground w-1/2">Map to</th>
            </tr>
          </thead>
          <tbody>
            {headers.map(h => (
              <tr key={h} className="border-b last:border-0">
                <td className="px-4 py-2 font-mono text-xs">{h}</td>
                <td className="px-4 py-2">
                  <Select
                    value={columnMap[h] ?? 'extra'}
                    onValueChange={v => onColChange(h, v as EventField)}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allFields.map(f => (
                        <SelectItem key={f} value={f} className="text-xs">
                          {EVENT_FIELD_LABELS[f]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!ok && (
        <p className="text-sm text-destructive">
          Required fields not mapped: {missing.join(', ')}
        </p>
      )}

      <div className="flex justify-between">
        <Button variant="outline" size="sm" onClick={onBack}>Back</Button>
        <Button size="sm" onClick={onNext} disabled={!ok}>Preview</Button>
      </div>
    </div>
  )
}

function StepPreview({
  rawRows,
  columnMap,
  onBack,
  onImport,
  isPending,
  error,
}: {
  rawRows: ParsedRow[]
  columnMap: Record<string, EventField>
  onBack: () => void
  onImport: () => void
  isPending: boolean
  error: string | null
}) {
  const mapped = buildMappedRows(rawRows, columnMap)
  const skipped = rawRows.length - mapped.length
  const preview = mapped.slice(0, 8)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm">
        <Badge variant="secondary">{mapped.length} valid rows</Badge>
        {skipped > 0 && (
          <Badge variant="outline" className="text-muted-foreground">
            {skipped} skipped (missing title or start date)
          </Badge>
        )}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Title</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Start</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">End</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Country</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((row, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-3 py-2 max-w-xs truncate">{row.title}</td>
                <td className="px-3 py-2 whitespace-nowrap">{row.start_date}</td>
                <td className="px-3 py-2 whitespace-nowrap">{row.end_date ?? '—'}</td>
                <td className="px-3 py-2">{row.status ?? '—'}</td>
                <td className="px-3 py-2">{row.country ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {mapped.length > 8 && (
          <p className="px-3 py-2 text-xs text-muted-foreground border-t">
            …and {mapped.length - 8} more rows
          </p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-between">
        <Button variant="outline" size="sm" onClick={onBack} disabled={isPending}>Back</Button>
        <Button size="sm" onClick={onImport} disabled={isPending || mapped.length === 0}>
          {isPending ? 'Importing…' : `Import ${mapped.length} rows`}
        </Button>
      </div>
    </div>
  )
}

function StepImporting() {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <Progress value={null} className="w-full" />
      <p className="text-sm text-muted-foreground">Importing events…</p>
    </div>
  )
}

function StepDone({
  result,
  onReset,
}: {
  result: NonNullable<WizardState['result']>
  onReset: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/20 p-6 space-y-3">
        <div className="flex gap-6 text-sm">
          <div>
            <p className="text-2xl font-semibold">{result.inserted}</p>
            <p className="text-muted-foreground">New events added</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">{result.updated}</p>
            <p className="text-muted-foreground">Existing events updated</p>
          </div>
        </div>

        {result.errors.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-destructive">{result.errors.length} errors</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {result.errors.slice(0, 5).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {result.errors.length > 5 && (
                <li>…and {result.errors.length - 5} more</li>
              )}
            </ul>
          </div>
        )}
      </div>

      <Button variant="outline" size="sm" onClick={onReset}>Import another file</Button>
    </div>
  )
}

// ── Main wizard ───────────────────────────────────────────────────────────────
export default function ImportWizard() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)
  const [isPending, startTransition] = useTransition()

  const STEPS = ['Upload', 'Map Columns', 'Preview', 'Done']
  const stepIndex = { upload: 0, map: 1, preview: 2, importing: 2, done: 3 }[state.step]

  async function handleFile(file: File) {
    try {
      const { headers, rows } = await parseFile(file)
      if (!headers.length) {
        dispatch({ type: 'SET_ERROR', error: 'File appears to be empty.' })
        return
      }
      dispatch({ type: 'SET_FILE', fileName: file.name, headers, rows })
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: (err as Error).message })
    }
  }

  function handleImport() {
    dispatch({ type: 'START_IMPORT' })
    const mapped = buildMappedRows(state.rawRows, state.columnMap)
    startTransition(async () => {
      try {
        const result = await importEvents(mapped)
        dispatch({ type: 'SET_RESULT', result })
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: (err as Error).message })
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors ${
              i < stepIndex
                ? 'bg-primary text-primary-foreground'
                : i === stepIndex
                ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                : 'bg-muted text-muted-foreground'
            }`}>
              {i < stepIndex ? '✓' : i + 1}
            </div>
            <span className={`text-xs ${i === stepIndex ? 'font-medium' : 'text-muted-foreground'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-8 ${i < stepIndex ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {state.step === 'upload' && (
        <StepUpload onFile={handleFile} error={state.error} />
      )}
      {state.step === 'map' && (
        <StepMap
          headers={state.rawHeaders}
          columnMap={state.columnMap}
          onColChange={(h, f) => dispatch({ type: 'SET_COL', header: h, field: f })}
          onBack={() => dispatch({ type: 'RESET' })}
          onNext={() => dispatch({ type: 'GO_TO_PREVIEW' })}
        />
      )}
      {(state.step === 'preview' || state.step === 'importing') && (
        <StepPreview
          rawRows={state.rawRows}
          columnMap={state.columnMap}
          onBack={() => dispatch({ type: 'SET_FILE', fileName: state.fileName!, headers: state.rawHeaders, rows: state.rawRows })}
          onImport={handleImport}
          isPending={isPending || state.step === 'importing'}
          error={state.error}
        />
      )}
      {state.step === 'importing' && <StepImporting />}
      {state.step === 'done' && state.result && (
        <StepDone result={state.result} onReset={() => dispatch({ type: 'RESET' })} />
      )}
    </div>
  )
}
