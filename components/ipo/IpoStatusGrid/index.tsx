'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Info } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface IpoStat {
  id:        string
  name:      string
  color_hex: string | null
  total:     number
  upcoming:  number
  ongoing:   number
  past:      number
}

interface ScrapeRun {
  ipo_id:        string
  status:        string
  error_message: string | null
  started_at:    string
}

interface Props {
  ipoStats:   IpoStat[]
  scrapeRuns: ScrapeRun[]
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_DOT: Record<string, string> = {
  success: 'bg-green-500',
  partial: 'bg-yellow-500',
  skipped: 'bg-gray-400',
  running: 'bg-blue-500 animate-pulse',
  queued:  'bg-blue-400 animate-pulse',
  failed:  'bg-red-500',
}

const STATUS_LABEL: Record<string, string> = {
  success: 'Synced',
  partial: 'Partial sync',
  skipped: 'No change',
  running: 'Syncing…',
  queued:  'Queued',
  failed:  'Sync failed',
}

export default function IpoStatusGrid({ ipoStats, scrapeRuns }: Props) {
  const runMap = new Map(scrapeRuns.map(r => [r.ipo_id, r]))

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ipoStats.map(ipo => {
        const run = runMap.get(ipo.id) ?? null

        return (
          <Card key={ipo.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <span
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: ipo.color_hex ?? 'hsl(var(--primary))' }}
                />
                {ipo.name}
                <span className="ml-auto text-xs font-normal text-muted-foreground tabular-nums">
                  {ipo.total} total
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end gap-6">
                <div>
                  <p className="text-xl font-semibold tabular-nums">{ipo.upcoming}</p>
                  <p className="text-xs text-muted-foreground">Upcoming</p>
                </div>
                <div>
                  <p className="text-xl font-semibold tabular-nums">{ipo.ongoing}</p>
                  <p className="text-xs text-muted-foreground">Ongoing</p>
                </div>
                <div>
                  <p className="text-xl font-semibold tabular-nums">{ipo.past}</p>
                  <p className="text-xs text-muted-foreground">Past</p>
                </div>
              </div>

              {/* Scrape status row */}
              <div className="flex items-center gap-1.5 pt-1 border-t">
                <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${run ? (STATUS_DOT[run.status] ?? 'bg-gray-400') : 'bg-gray-300'}`} />
                <span className="text-xs text-muted-foreground">
                  {run ? STATUS_LABEL[run.status] ?? run.status : 'Never synced'}
                </span>
                {run && (
                  <span className="text-xs text-muted-foreground/60 ml-1">
                    · {fmtDate(run.started_at)}
                  </span>
                )}
                {run?.status === 'failed' && run.error_message && (
                  <Popover>
                    <PopoverTrigger className="ml-auto inline-flex items-center justify-center rounded p-0.5 text-red-500 hover:text-red-700 transition-colors">
                      <Info className="h-3.5 w-3.5" />
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-3" align="end">
                      <p className="text-xs font-medium text-destructive mb-1">Sync error</p>
                      <p className="text-xs text-muted-foreground leading-relaxed break-words">
                        {run.error_message}
                      </p>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
