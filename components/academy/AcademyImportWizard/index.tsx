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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Info } from 'lucide-react'
import { importAcademyEvents } from '@/app/dashboard/academy/import/actions'
import type { AcademyMappedRow } from '@/app/dashboard/academy/import/actions'
import type { WizardState, WizardAction, ParsedRow, AcademyField } from './types'
import { INITIAL_STATE, ACADEMY_FIELD_LABELS } from './types'

// ── Auto-detect column mappings ───────────────────────────────────────────────
const FIELD_ALIASES: Record<AcademyField, string[]> = {
  academy_id:        ['id', 'academy_id', 'course id', 'event id', 'identifier', 'code'],
  title:             ['title', 'event title', 'event name', 'name', 'course title', 'course name'],
  description:       ['description', 'content', 'overview', 'about', 'summary'],
  start_date:        ['start date', 'start_date', 'date', 'begin date', 'from', 'start',
                      'event start date'],
  end_date:          ['end date', 'end_date', 'to', 'finish date', 'end', 'until',
                      'event end date'],
  status:            ['status', 'state'],
  training_type:     ['training type', 'training_type', 'type', 'event type', 'type of training'],
  lead_organizer:    ['lead organizer', 'lead organiser', 'organizer', 'organiser', 'host',
                      'corresponding/lead organizer', 'corresponding organizer'],
  partner_organizer: ['partner organizer', 'partner organiser', 'partner', 'co-organizer'],
  categories:        ['categories', 'category', 'themes'],
  delivery_mode:     ['delivery mode', 'delivery_mode', 'delivery', 'mode', 'format', 'modality',
                      'mode of delivery'],
  location:          ['location', 'venue', 'city', 'place', 'location/platform'],
  languages:         ['languages', 'language', 'lang',
                      'language/s used in the training', 'languages used in the training'],
  target_audience:   ['target audience', 'target_audience', 'audience', 'target'],
  level:             ['level', 'difficulty', 'grade'],
  cost:              ['cost', 'fee', 'price', 'registration fee', 'cost / fee', 'cost/fee'],
  funding_support:   ['funding support', 'funding_support', 'funding', 'scholarship'],
  certificate:       ['certificate', 'certification', 'cert', 'certificate of completion'],
  term_of_use:       ['term of use', 'terms of use', 'term_of_use', 'terms'],
  contact_person:    ['contact person', 'contact_person', 'official contact person', 'contact name'],
  official_link:     ['official link', 'official_link', 'url', 'link', 'website', 'href', 'web'],
  permalink:         ['permalink', 'application link', 'page url', 'page link', 'catalogue url'],
  contact_email:     ['contact email', 'contact_email', 'email', 'official contact email'],
  catalogue_tags:    ['catalogue tags', 'catalog tags', 'tags', 'catalogue_tags'],
  extra_field:       [],
  skip:              [],
}

// Required → Key field → Other mapped → Skip
// Lower number = shown first
const FIELD_SORT_ORDER: Record<AcademyField, number> = {
  title:             0,
  academy_id:        1,
  start_date:        2,
  end_date:          3,
  official_link:     4,
  status:            5,
  lead_organizer:    6,
  partner_organizer: 7,
  categories:        8,
  training_type:     9,
  delivery_mode:     10,
  location:          11,
  languages:         12,
  target_audience:   13,
  level:             14,
  cost:              15,
  funding_support:   16,
  certificate:       17,
  term_of_use:       18,
  contact_person:    19,
  permalink:         20,
  contact_email:     21,
  catalogue_tags:    22,
  description:       23,
  extra_field:       98,
  skip:              99,
}

const FIELD_TIER: Record<AcademyField, 'required' | 'recommended' | 'other'> = {
  title:             'required',
  academy_id:        'recommended',
  start_date:        'recommended',
  end_date:          'recommended',
  official_link:     'recommended',
  status:            'other',
  description:       'other',
  training_type:     'other',
  lead_organizer:    'other',
  partner_organizer: 'other',
  categories:        'other',
  delivery_mode:     'other',
  location:          'other',
  languages:         'other',
  target_audience:   'other',
  level:             'other',
  cost:              'other',
  funding_support:   'other',
  certificate:       'other',
  term_of_use:       'other',
  contact_person:    'other',
  permalink:         'other',
  contact_email:     'other',
  catalogue_tags:    'other',
  extra_field:       'other',
  skip:              'other',
}

function autoDetect(headers: string[]): Record<string, AcademyField> {
  const map: Record<string, AcademyField> = {}
  for (const h of headers) {
    const lower = h.toLowerCase().trim()
    let matched: AcademyField = 'extra_field'
    for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [AcademyField, string[]][]) {
      if (field === 'skip') continue
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

// ── Date helpers ──────────────────────────────────────────────────────────────
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

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // DD-Mon-YY or DD-Mon-YYYY  →  e.g. "12-Mar-25", "12-Mar-2025"
  const dmy = s.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{2,4})$/)
  if (dmy) {
    const [, d, mon, yr] = dmy
    const month = MONTH_ABBR[mon.toLowerCase()]
    if (month) {
      const year = yr.length === 2
        ? (parseInt(yr) < 50 ? `20${yr}` : `19${yr}`)
        : yr
      return `${year}-${month}-${d.padStart(2, '0')}`
    }
  }

  // Strip trailing timezone text before generic parse
  // e.g. "Mon Mar 12 2025 00:00:00 GMT+0800 (Philippine Standard Time)"
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
        const wb   = XLSX.read(data, { type: 'array', cellDates: true })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const raw  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]

        if (!raw.length) { resolve({ headers: [], rows: [] }); return }

        const headers = (raw[0] as string[]).map(String)
        const rows    = raw.slice(1).map(row =>
          Object.fromEntries(headers.map((h, i) => {
            const val = (row as unknown[])[i]
            // XLSX converts date cells to JS Date objects when cellDates: true.
            // String(date) produces "Mon Jan 15 2024 00:00:00 GMT+0800 ..." which
            // Postgres rejects. Format as YYYY-MM-DD instead.
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

const DATE_FIELDS    = new Set<AcademyField>(['start_date', 'end_date'])
const BOOL_FIELDS    = new Set<AcademyField>(['cost', 'funding_support', 'certificate', 'term_of_use'])
const BOOL_TRUE_PAT  = /^(yes|true|1|y|agreed|paid)$/i
const BOOL_FALSE_PAT = /^(no|false|0|n|none|free|gratis|no cost|no fee)$/i

function parseBoolVal(raw: string): boolean | null {
  const s = raw.trim()
  if (BOOL_TRUE_PAT.test(s))  return true
  if (BOOL_FALSE_PAT.test(s)) return false
  return null
}

// ── Build mapped rows ─────────────────────────────────────────────────────────
function buildMappedRows(rawRows: ParsedRow[], columnMap: Record<string, AcademyField>): AcademyMappedRow[] {
  return rawRows
    .map(row => {
      const mapped: Partial<AcademyMappedRow> = {}
      const extra: Record<string, string> = {}
      for (const [header, field] of Object.entries(columnMap)) {
        if (field === 'skip') continue
        const val = row[header]?.trim() ?? ''
        if (!val) continue
        if (field === 'extra_field') {
          extra[header] = val
        } else if (BOOL_FIELDS.has(field)) {
          const b = parseBoolVal(val)
          if (b !== null) (mapped as Record<string, unknown>)[field] = b
        } else {
          ;(mapped as Record<string, string>)[field] = DATE_FIELDS.has(field)
            ? normalizeDate(val)
            : val
        }
      }
      if (Object.keys(extra).length > 0) mapped.extra_fields = extra
      return mapped as AcademyMappedRow
    })
    .filter(r => !!r.title)
}

function isMappingValid(columnMap: Record<string, AcademyField>): boolean {
  return Object.values(columnMap).includes('title')
}

// ── Step: Upload ──────────────────────────────────────────────────────────────
function StepUpload({ onFile, error }: { onFile: (f: File) => void; error: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-4">
      <div
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f) }}
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

// ── Step: Map columns ─────────────────────────────────────────────────────────
function StepMap({
  headers,
  columnMap,
  onColChange,
  onBack,
  onNext,
}: {
  headers: string[]
  columnMap: Record<string, AcademyField>
  onColChange: (header: string, field: AcademyField) => void
  onBack: () => void
  onNext: () => void
}) {
  const valid     = isMappingValid(columnMap)
  const allFields = Object.keys(ACADEMY_FIELD_LABELS) as AcademyField[]

  // Sort: required first → recommended → other mapped → skip last
  const sortedHeaders = [...headers].sort((a, b) => {
    return FIELD_SORT_ORDER[columnMap[a] ?? 'skip'] - FIELD_SORT_ORDER[columnMap[b] ?? 'skip']
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Columns are sorted by importance. Columns set to <span className="font-medium">Skip</span> will not be imported.
      </p>

      <div className="rounded-md border overflow-hidden max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
            <tr className="border-b">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">File column</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Map to</th>
              <th className="px-4 py-2 w-20" />
            </tr>
          </thead>
          <tbody>
            {sortedHeaders.map(h => {
              const mapped = columnMap[h] ?? 'skip'
              const tier   = FIELD_TIER[mapped]
              return (
                <tr
                  key={h}
                  className={`border-b last:border-0 ${mapped === 'skip' ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-2 font-mono text-xs max-w-[180px] truncate">{h}</td>
                  <td className="px-4 py-2">
                    <Select
                      value={mapped}
                      onValueChange={v => onColChange(h, v as AcademyField)}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allFields.map(f => (
                          <SelectItem key={f} value={f} className="text-xs">
                            {ACADEMY_FIELD_LABELS[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2">
                    {tier === 'required' && (
                      <span className="text-xs font-medium text-destructive">Required</span>
                    )}
                    {tier === 'recommended' && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">Key field</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!valid && (
        <p className="text-sm text-destructive">Required: map at least one column to &quot;Title&quot;.</p>
      )}

      <div className="flex justify-between">
        <Button variant="outline" size="sm" onClick={onBack}>Back</Button>
        <Button size="sm" onClick={onNext} disabled={!valid}>Preview</Button>
      </div>
    </div>
  )
}

// ── Step: Preview ─────────────────────────────────────────────────────────────
function StepPreview({
  rawRows,
  columnMap,
  onBack,
  onImport,
  isPending,
  error,
}: {
  rawRows: ParsedRow[]
  columnMap: Record<string, AcademyField>
  onBack: () => void
  onImport: () => void
  isPending: boolean
  error: string | null
}) {
  const mapped  = buildMappedRows(rawRows, columnMap)
  const skipped = rawRows.length - mapped.length
  const preview = mapped.slice(0, 8)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm">
        <Badge variant="secondary">{mapped.length} valid rows</Badge>
        {skipped > 0 && (
          <Badge variant="outline" className="text-muted-foreground">
            {skipped} skipped (missing title)
          </Badge>
        )}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Title</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Start</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Lead Organizer</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((row, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-3 py-2 max-w-xs truncate">{row.title}</td>
                <td className="px-3 py-2 whitespace-nowrap">{row.start_date ?? '—'}</td>
                <td className="px-3 py-2">{row.status ?? '—'}</td>
                <td className="px-3 py-2">{row.training_type ?? '—'}</td>
                <td className="px-3 py-2 max-w-[140px] truncate">{row.lead_organizer ?? '—'}</td>
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

// ── Step: Done ────────────────────────────────────────────────────────────────
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
              {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
              {result.errors.length > 5 && <li>…and {result.errors.length - 5} more</li>}
            </ul>
          </div>
        )}
      </div>

      <Button variant="outline" size="sm" onClick={onReset}>Import another file</Button>
    </div>
  )
}

// ── Main wizard ───────────────────────────────────────────────────────────────
export default function AcademyImportWizard() {
  const [state, dispatch]       = useReducer(reducer, INITIAL_STATE)
  const [isPending, startTransition] = useTransition()

  const STEPS     = ['Upload', 'Map Columns', 'Preview', 'Done']
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
        const result = await importAcademyEvents(mapped)
        dispatch({ type: 'SET_RESULT', result })
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: (err as Error).message })
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Step indicators + info button */}
      <div className="flex items-center justify-between">
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

        <Dialog>
          <DialogTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Info className="h-3.5 w-3.5" />
            How to import
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Import guide</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm overflow-y-auto flex-1 pr-1">

              <div className="space-y-1">
                <p className="font-medium">Supported formats</p>
                <p className="text-muted-foreground">CSV, XLSX, or XLS. The first row must be column headers.</p>
              </div>

              <div className="space-y-1">
                <p className="font-medium">Required column</p>
                <p className="text-muted-foreground">Only <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">Title</span> is required. All other columns are optional.</p>
              </div>

              <div className="space-y-2">
                <p className="font-medium">Recognised column headers</p>
                <div className="rounded-md border text-xs overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-1.5 text-left font-medium">Your column</th>
                        <th className="px-3 py-1.5 text-left font-medium">Maps to</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      {[
                        ['ID / Academy ID',                   'Academy ID (used for deduplication)'],
                        ['Title',                             'Title ✱ required'],
                        ['Event start date / Start date',     'Start Date'],
                        ['Event end date / End date',         'End Date'],
                        ['Status',                            'Status'],
                        ['Corresponding/Lead organizer',      'Lead Organizer'],
                        ['Partner organizer',                 'Partner Organizer'],
                        ['Type of training',                  'Training Type'],
                        ['Mode of delivery',                  'Delivery Mode'],
                        ['Location/Platform',                 'Location'],
                        ['Language/s used in the training',   'Languages'],
                        ['Target Audience',                   'Target Audience'],
                        ['Level',                             'Level'],
                        ['Cost / Fee',                        'Cost'],
                        ['Certificate of completion',         'Certificate'],
                        ['Official link',                     'Official Link'],
                        ['Permalink',                         'Permalink'],
                        ['Official contact email',            'Contact Email'],
                        ['Catalogue tags',                    'Catalogue Tags'],
                      ].map(([col, field]) => (
                        <tr key={col} className="border-b last:border-0">
                          <td className="px-3 py-1.5 font-mono">{col}</td>
                          <td className="px-3 py-1.5">{field}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-1">
                <p className="font-medium">Dates</p>
                <p className="text-muted-foreground">
                  Accepted formats: <span className="font-mono text-xs bg-muted px-1 rounded">YYYY-MM-DD</span>,{' '}
                  <span className="font-mono text-xs bg-muted px-1 rounded">12-Mar-25</span>,{' '}
                  <span className="font-mono text-xs bg-muted px-1 rounded">12-Mar-2025</span>, or native Excel date cells.
                </p>
              </div>

              <div className="space-y-1">
                <p className="font-medium">Deduplication</p>
                <p className="text-muted-foreground">
                  If a row has an <span className="font-mono text-xs bg-muted px-1 rounded">Academy ID</span>, existing records with the same ID are updated.
                  Rows without an ID are matched by title — existing titles are updated, new ones are inserted.
                </p>
              </div>

              <div className="space-y-1">
                <p className="font-medium">Unknown columns</p>
                <p className="text-muted-foreground">
                  Any column not recognised above is set to <span className="font-medium">Extra field (keep as-is)</span> by default —
                  its value is stored as-is and will be available in the CMS.
                  Change it to <span className="font-medium">Skip (discard)</span> in the Map Columns step if you don&apos;t need it.
                </p>
              </div>

            </div>
          </DialogContent>
        </Dialog>
      </div>

      {state.step === 'upload' && <StepUpload onFile={handleFile} error={state.error} />}
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
        <>
          <StepPreview
            rawRows={state.rawRows}
            columnMap={state.columnMap}
            onBack={() => dispatch({ type: 'SET_FILE', fileName: state.fileName!, headers: state.rawHeaders, rows: state.rawRows })}
            onImport={handleImport}
            isPending={isPending || state.step === 'importing'}
            error={state.error}
          />
          {state.step === 'importing' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <Progress value={null} className="w-full" />
              <p className="text-sm text-muted-foreground">Importing academy events…</p>
            </div>
          )}
        </>
      )}
      {state.step === 'done' && state.result && (
        <StepDone result={state.result} onReset={() => dispatch({ type: 'RESET' })} />
      )}
    </div>
  )
}
