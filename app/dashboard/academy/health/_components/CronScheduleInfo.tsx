'use client'

import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { SCRAPE_SCHEDULE, formatUtcMinutes } from '@/lib/data/scrape-schedule'

export default function CronScheduleInfo() {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        <Clock />
        Schedule
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="px-4 py-3 border-b">
          <p className="text-sm font-medium">Auto-scrape schedule</p>
          <p className="text-xs text-muted-foreground mt-0.5">All times UTC · runs twice daily</p>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">IPO</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Method</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Runs at</th>
            </tr>
          </thead>
          <tbody>
            {SCRAPE_SCHEDULE.map(entry => (
              <tr key={entry.ipoId} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{entry.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{entry.method}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {entry.times.map(formatUtcMinutes).join(' · ')}
                </td>
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
