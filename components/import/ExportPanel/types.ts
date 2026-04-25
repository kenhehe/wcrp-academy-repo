export type ExportFormat = 'csv' | 'xlsx'

export interface ExportState {
  status: string
  year: string
  format: ExportFormat
  loading: boolean
}
