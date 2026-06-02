'use client'

import { Info } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

const SCHEDULE = [
  { ipo: 'GEWEX',  method: 'HTML scraper',    morning: '08:00', evening: '20:00' },
  { ipo: 'CORDEX', method: 'HTML scraper',    morning: '08:15', evening: '20:15' },
  { ipo: 'ESMO',   method: 'HTML scraper',    morning: '08:30', evening: '20:30' },
  { ipo: 'RIfS',   method: 'HTML scraper',    morning: '08:45', evening: '20:45' },
  { ipo: 'CMIP',   method: 'Cloudflare ⚠',   morning: '09:00', evening: '21:00' },
  { ipo: 'CliC',   method: 'Elfsight API',    morning: '09:45', evening: '21:45' },
  { ipo: 'CLIVAR', method: 'HTML scraper',    morning: '10:00', evening: '22:00' },
]

export default function CronScheduleInfo() {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors">
        <Info className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="px-4 py-3 border-b">
          <p className="text-sm font-medium">Auto-scrape schedule</p>
          <p className="text-xs text-muted-foreground mt-0.5">All times in UTC+8 · runs twice daily</p>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">IPO</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Method</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Morning</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Evening</th>
            </tr>
          </thead>
          <tbody>
            {SCHEDULE.map(row => (
              <tr key={row.ipo} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{row.ipo}</td>
                <td className="px-4 py-2 text-muted-foreground">{row.method}</td>
                <td className="px-4 py-2 text-right tabular-nums">{row.morning}</td>
                <td className="px-4 py-2 text-right tabular-nums">{row.evening}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2.5 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground">
            CMIP is currently blocked by Cloudflare. Pending whitelist approval from the CMIP team.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
