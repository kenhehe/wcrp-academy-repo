'use client'

import { useState, useTransition } from 'react'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getAcademyExportData } from '@/app/dashboard/academy/import/actions'
import type { AcademyExportRow } from '@/app/dashboard/academy/import/actions'
import type { ExportFormat } from './types'

interface AcademyExportPanelProps {
  availableYears:  number[]
  trainingTypes:   string[]
  statusOptions:   string[]
}

export default function AcademyExportPanel({
  availableYears,
  trainingTypes,
  statusOptions,
}: AcademyExportPanelProps) {
  const [status,        setStatus]        = useState('all')
  const [trainingType,  setTrainingType]  = useState('all')
  const [year,          setYear]          = useState('all')
  const [format,        setFormat]        = useState<ExportFormat>('xlsx')
  const [isPending,     startTransition]  = useTransition()
  const [error,         setError]         = useState<string | null>(null)

  function handleExport() {
    setError(null)
    startTransition(async () => {
      try {
        const data = await getAcademyExportData({
          status:        status        === 'all' ? undefined : status,
          training_type: trainingType  === 'all' ? undefined : trainingType,
          year:          year          === 'all' ? undefined : parseInt(year),
        })

        if (!data.length) {
          setError('No events found for the selected filters.')
          return
        }

        const rows = data.map((row: AcademyExportRow) => ({
          academy_id:        row.academy_id        ?? '',
          title:             row.title,
          start_date:        row.start_date        ?? '',
          end_date:          row.end_date           ?? '',
          status:            row.status             ?? '',
          training_type:     row.training_type      ?? '',
          lead_organizer:    row.lead_organizer     ?? '',
          partner_organizer: row.partner_organizer  ?? '',
          categories:        row.categories         ?? '',
          delivery_mode:     row.delivery_mode      ?? '',
          location:          row.location           ?? '',
          languages:         row.languages          ?? '',
          target_audience:   row.target_audience    ?? '',
          level:             row.level              ?? '',
          cost:              row.cost               ?? '',
          certificate:       row.certificate        ?? '',
          official_link:     row.official_link      ?? '',
          permalink:         row.permalink          ?? '',
          contact_email:     row.contact_email      ?? '',
          catalogue_tags:    row.catalogue_tags     ?? '',
        }))

        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Academy Events')

        const fileName = `academy_events_${new Date().toISOString().slice(0, 10)}.${format}`

        if (format === 'csv') {
          const csv = XLSX.utils.sheet_to_csv(ws)
          download(new Blob([csv], { type: 'text/csv' }), fileName)
        } else {
          const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
          download(
            new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
            fileName
          )
        }
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Export the Academy Events catalogue to CSV or XLSX.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select value={status} onValueChange={v => { if (v) setStatus(v) }}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statusOptions.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Training Type</label>
          <Select value={trainingType} onValueChange={v => { if (v) setTrainingType(v) }}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {trainingTypes.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Year</label>
          <Select value={year} onValueChange={v => { if (v) setYear(v) }}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {availableYears.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Format</label>
          <Select value={format} onValueChange={v => setFormat(v as ExportFormat)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
              <SelectItem value="csv">CSV (.csv)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={handleExport} disabled={isPending}>
        {isPending ? 'Preparing export…' : 'Download export'}
      </Button>
    </div>
  )
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
