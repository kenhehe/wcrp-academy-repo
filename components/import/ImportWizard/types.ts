import type { ImportResult } from '@/app/dashboard/ipo/import/actions'

export type { ImportResult }

export type WizardStep = 'upload' | 'map' | 'preview' | 'importing' | 'done'

// All known event fields a column can be mapped to
export type EventField =
  | 'title'
  | 'start_date'
  | 'end_date'
  | 'status'
  | 'location'
  | 'country'
  | 'url'
  | 'source'
  | 'extra'
  | 'skip'

export const EVENT_FIELD_LABELS: Record<EventField, string> = {
  title:      'Title',
  start_date: 'Start Date',
  end_date:   'End Date',
  status:     'Status',
  location:   'Location',
  country:    'Country',
  url:        'URL',
  source:     'Source',
  extra:      'Extra field',
  skip:       'Skip (ignore)',
}

export interface ParsedRow {
  [header: string]: string
}

export interface WizardState {
  step: WizardStep
  fileName: string | null
  rawHeaders: string[]
  rawRows: ParsedRow[]
  columnMap: Record<string, EventField>
  result: ImportResult | null
  error: string | null
}

export type WizardAction =
  | { type: 'SET_FILE'; fileName: string; headers: string[]; rows: ParsedRow[] }
  | { type: 'SET_COL'; header: string; field: EventField }
  | { type: 'GO_TO_PREVIEW' }
  | { type: 'START_IMPORT' }
  | { type: 'SET_RESULT'; result: ImportResult }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'RESET' }

export const INITIAL_STATE: WizardState = {
  step: 'upload',
  fileName: null,
  rawHeaders: [],
  rawRows: [],
  columnMap: {},
  result: null,
  error: null,
}
