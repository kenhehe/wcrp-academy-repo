import type { AcademyImportResult } from '@/app/dashboard/academy/import/actions'

export type { AcademyImportResult }

export type WizardStep = 'upload' | 'map' | 'preview' | 'importing' | 'done'

export type AcademyField =
  | 'academy_id'
  | 'title'
  | 'start_date'
  | 'end_date'
  | 'status'
  | 'training_type'
  | 'lead_organizer'
  | 'partner_organizer'
  | 'categories'
  | 'delivery_mode'
  | 'location'
  | 'languages'
  | 'target_audience'
  | 'level'
  | 'cost'
  | 'certificate'
  | 'official_link'
  | 'permalink'
  | 'contact_email'
  | 'catalogue_tags'
  | 'extra_field'
  | 'skip'

export const ACADEMY_FIELD_LABELS: Record<AcademyField, string> = {
  academy_id:        'Academy ID',
  title:             'Title',
  start_date:        'Start Date',
  end_date:          'End Date',
  status:            'Status',
  training_type:     'Training Type',
  lead_organizer:    'Lead Organizer',
  partner_organizer: 'Partner Organizer',
  categories:        'Categories',
  delivery_mode:     'Delivery Mode',
  location:          'Location',
  languages:         'Languages',
  target_audience:   'Target Audience',
  level:             'Level',
  cost:              'Cost',
  certificate:       'Certificate',
  official_link:     'Official Link',
  permalink:         'Permalink',
  contact_email:     'Contact Email',
  catalogue_tags:    'Catalogue Tags',
  extra_field:       'Extra field (keep as-is)',
  skip:              'Skip (discard)',
}

export interface ParsedRow {
  [header: string]: string
}

export interface WizardState {
  step:       WizardStep
  fileName:   string | null
  rawHeaders: string[]
  rawRows:    ParsedRow[]
  columnMap:  Record<string, AcademyField>
  result:     AcademyImportResult | null
  error:      string | null
}

export type WizardAction =
  | { type: 'SET_FILE'; fileName: string; headers: string[]; rows: ParsedRow[] }
  | { type: 'SET_COL'; header: string; field: AcademyField }
  | { type: 'GO_TO_PREVIEW' }
  | { type: 'START_IMPORT' }
  | { type: 'SET_RESULT'; result: AcademyImportResult }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'RESET' }

export const INITIAL_STATE: WizardState = {
  step:       'upload',
  fileName:   null,
  rawHeaders: [],
  rawRows:    [],
  columnMap:  {},
  result:     null,
  error:      null,
}
