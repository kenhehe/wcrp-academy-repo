'use client'

import { useState, useMemo } from 'react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ExternalLinkIcon, MapPinIcon, CalendarIcon } from 'lucide-react'

export interface CalendarEvent {
  id: string
  ipo_id: string
  title: string
  start_date: string
  end_date: string | null
  status: string
  location: string | null
  country: string | null
  url: string | null
}

export interface IPORow {
  id: string
  name: string
  color_hex: string | null
}

interface Props {
  events: CalendarEvent[]
  ipos: IPORow[]
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { 'en-US': enUS },
})

const STATUS_COLOR: Record<string, string> = {
  Upcoming: '#2563eb',
  Ongoing:  '#16a34a',
  Past:     '#94a3b8',
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default function CalendarView({ events, ipos }: Props) {
  const [selectedIpo, setSelectedIpo] = useState<string>('all')
  const [selected, setSelected] = useState<CalendarEvent | null>(null)

  const ipoMap = useMemo(
    () => new Map(ipos.map(i => [i.id, i])),
    [ipos],
  )

  const filtered = useMemo(
    () => selectedIpo === 'all' ? events : events.filter(e => e.ipo_id === selectedIpo),
    [events, selectedIpo],
  )

  const calEvents = useMemo(() =>
    filtered.map(e => {
      const start = new Date(e.start_date + 'T00:00:00')
      const end   = e.end_date
        ? new Date(e.end_date + 'T23:59:59')
        : new Date(e.start_date + 'T23:59:59')
      return { title: e.title, start, end, resource: e }
    }),
    [filtered],
  )

  const selectedIpo_ = selected ? ipoMap.get(selected.ipo_id) : null

  return (
    <Card style={{ overflow: 'visible' }}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Event Calendar</CardTitle>
        <Select value={selectedIpo} onValueChange={v => setSelectedIpo(v ?? 'all')}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue placeholder="All IPOs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All IPOs</SelectItem>
            {ipos.map(ipo => (
              <SelectItem key={ipo.id} value={ipo.id}>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: ipo.color_hex ?? '#94a3b8' }}
                  />
                  {ipo.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent>
        <div className="rbc-wrapper h-[600px]">
          <Calendar
            localizer={localizer}
            events={calEvents}
            defaultView="month"
            views={['month']}
            onSelectEvent={e => setSelected(e.resource as CalendarEvent)}
            eventPropGetter={e => {
              const ev = e.resource as CalendarEvent
              const ipo = ipoMap.get(ev.ipo_id)
              const bg  = ipo?.color_hex ?? STATUS_COLOR[ev.status] ?? '#2563eb'
              return {
                style: {
                  backgroundColor: bg,
                  borderColor: bg,
                  color: '#fff',
                  borderRadius: '4px',
                  fontSize: '11px',
                  padding: '1px 4px',
                },
              }
            }}
          />
        </div>
      </CardContent>

      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null) }}>
        {selected && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-start gap-2 pr-6">
                {selectedIpo_ && (
                  <span
                    className="mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: selectedIpo_.color_hex ?? '#94a3b8' }}
                  />
                )}
                <DialogTitle className="leading-snug">{selected.title}</DialogTitle>
              </div>
              {selectedIpo_ && (
                <DialogDescription>{selectedIpo_.name}</DialogDescription>
              )}
            </DialogHeader>

            <div className="space-y-3 text-sm">
              <Badge
                variant="secondary"
                style={{
                  backgroundColor: (STATUS_COLOR[selected.status] ?? '#94a3b8') + '22',
                  color: STATUS_COLOR[selected.status] ?? '#94a3b8',
                  borderColor: (STATUS_COLOR[selected.status] ?? '#94a3b8') + '44',
                }}
                className="border"
              >
                {selected.status}
              </Badge>

              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  {formatDate(selected.start_date)}
                  {selected.end_date && selected.end_date !== selected.start_date
                    ? ` — ${formatDate(selected.end_date)}`
                    : ''}
                </span>
              </div>

              {(selected.location || selected.country) && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPinIcon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    {[selected.location, selected.country].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}

              {selected.url && (
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-blue-500 hover:underline"
                >
                  <ExternalLinkIcon className="h-3.5 w-3.5" />
                  View event
                </a>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </Card>
  )
}
