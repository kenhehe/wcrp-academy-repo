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
import { getExportData } from '@/app/dashboard/ipo/import/actions'
import type { ExportFormat } from './types'

interface ExportPanelProps {
  availableYears: number[]
}

export default function ExportPanel({ availableYears }: ExportPanelProps) {
  const [status, setStatus] = useState('all')
  const [year,   setYear]   = useState('all')
  const [format, setFormat] = useState<ExportFormat>('xlsx')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleExport() {
    setError(null)
    startTransition(async () => {
      try {
        const data = await getExportData({
          status: status === 'all' ? undefined : status,
          year:   year   === 'all' ? undefined : parseInt(year),
        })

        if (!data.length) {
          setError('No events found for the selected filters.')
          return
        }

        // Flatten extra_fields into top-level columns
        const allExtraKeys = new Set<string>()
        for (const row of data) {
          for (const k of Object.keys(row.extra_fields ?? {})) allExtraKeys.add(k)
        }

        const rows = data.map(row => ({
          title:      row.title,
          start_date: row.start_date,
          end_date:   row.end_date ?? '',
          status:     row.status,
          location:   row.location ?? '',
          country:    row.country ?? '',
          url:        row.url ?? '',
          source:     row.source ?? '',
          ...[...allExtraKeys].reduce<Record<string, string>>((acc, k) => {
            acc[k] = (row.extra_fields as Record<string, string> | null)?.[k] ?? ''
            return acc
          }, {}),
        }))

        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Events')

        const fileName = `events_export_${new Date().toISOString().slice(0, 10)}.${format}`

        if (format === 'csv') {
          const csv = XLSX.utils.sheet_to_csv(ws)
          download(new Blob([csv], { type: 'text/csv' }), fileName)
        } else {
          const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
          download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName)
        }
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Export your events catalogue to CSV or XLSX. Extra fields are flattened into columns.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select value={status} onValueChange={v => { if (v) setStatus(v) }}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="Upcoming">Upcoming</SelectItem>
              <SelectItem value="Ongoing">Ongoing</SelectItem>
              <SelectItem value="Past">Past</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
              <SelectItem value="Postponed">Postponed</SelectItem>
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
