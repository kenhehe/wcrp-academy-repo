'use client'

import { useState, useMemo } from 'react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ExternalLinkIcon, MapPinIcon, CalendarIcon, EyeIcon, EyeOffIcon } from 'lucide-react'

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
  Upcoming:  '#2563eb',
  Ongoing:   '#16a34a',
  Past:      '#94a3b8',
  Cancelled: '#ef4444',
  Postponed: '#f97316',
}

const INACTIVE_STATUSES = new Set(['Past', 'Cancelled', 'Postponed'])

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

interface DayPopup {
  date:   Date
  events: Array<{ title: string; start: Date; end: Date; resource: CalendarEvent }>
}

export default function CalendarView({ events, ipos }: Props) {
  const [selectedIpo, setSelectedIpo] = useState<string>('all')
  const [selected, setSelected]       = useState<CalendarEvent | null>(null)
  const [showPast, setShowPast]       = useState(false)
  const [dayPopup, setDayPopup]       = useState<DayPopup | null>(null)

  const ipoMap = useMemo(
    () => new Map(ipos.map(i => [i.id, i])),
    [ipos],
  )

  // Events that pass the past toggle
  const visibleByStatus = useMemo(
    () => showPast ? events : events.filter(e => !INACTIVE_STATUSES.has(e.status)),
    [events, showPast],
  )

  // Per-IPO counts based on the toggle (for dropdown labels)
  const ipoCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of visibleByStatus) {
      map.set(e.ipo_id, (map.get(e.ipo_id) ?? 0) + 1)
    }
    return map
  }, [visibleByStatus])

  // Final filtered list (status toggle + IPO filter)
  const filtered = useMemo(
    () => selectedIpo === 'all'
      ? visibleByStatus
      : visibleByStatus.filter(e => e.ipo_id === selectedIpo),
    [visibleByStatus, selectedIpo],
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

  function openDayPopup(date: Date, evts?: typeof calEvents) {
    const d = new Date(date); d.setHours(0, 0, 0, 0)
    const dayEvts = evts ?? calEvents.filter(e => {
      const s = new Date(e.start); s.setHours(0, 0, 0, 0)
      const en = new Date(e.end);  en.setHours(0, 0, 0, 0)
      return d >= s && d <= en
    })
    if (dayEvts.length > 0) setDayPopup({ date: d, events: dayEvts })
  }

  return (
    <Card className="overflow-visible">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
        <div className="flex items-center gap-3">
          <CardTitle className="text-sm font-medium">Event Calendar</CardTitle>
          <Badge variant="secondary" className="tabular-nums text-xs">
            {filtered.length}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={showPast ? 'secondary' : 'outline'}
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setShowPast(p => !p)}
          >
            {showPast
              ? <><EyeOffIcon className="h-3 w-3" /> Hide inactive</>
              : <><EyeIcon    className="h-3 w-3" /> Show inactive</>
            }
          </Button>

          <Select value={selectedIpo} onValueChange={v => setSelectedIpo(v ?? 'all')}>
            <SelectTrigger size="sm" className="w-48">
              <SelectValue placeholder="All IPOs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="flex items-center justify-between w-full gap-3">
                  <span>All IPOs</span>
                  <span className="text-xs text-muted-foreground tabular-nums ml-auto">
                    {visibleByStatus.length}
                  </span>
                </span>
              </SelectItem>
              {ipos.map(ipo => {
                const count = ipoCounts.get(ipo.id) ?? 0
                return (
                  <SelectItem key={ipo.id} value={ipo.id}>
                    <span className="flex items-center gap-1.5 w-full">
                      <span
                        className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: ipo.color_hex ?? '#94a3b8' }}
                      />
                      <span className="flex-1">{ipo.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums ml-2">
                        {count}
                      </span>
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="rbc-wrapper h-[580px] rounded-lg border border-border/30 bg-muted/10 p-3">
          <Calendar
            localizer={localizer}
            events={calEvents}
            defaultView="month"
            views={['month']}
            selectable
            onSelectEvent={e => setSelected(e.resource as CalendarEvent)}
            onSelectSlot={slot => openDayPopup(slot.start)}
            onShowMore={(evts, date) => openDayPopup(date, evts)}
            eventPropGetter={e => {
              const ev  = e.resource as CalendarEvent
              const ipo = ipoMap.get(ev.ipo_id)
              const bg  = ipo?.color_hex ?? STATUS_COLOR[ev.status] ?? '#2563eb'
              const isPast = INACTIVE_STATUSES.has(ev.status)
              return {
                style: {
                  backgroundColor: bg,
                  borderColor: bg,
                  color: '#fff',
                  borderRadius: '5px',
                  fontSize: '11px',
                  fontWeight: 500,
                  padding: '2px 5px',
                  opacity: isPast ? 0.55 : 1,
                  cursor: 'pointer',
                },
              }
            }}
            dayPropGetter={date => {
              const today = new Date()
              const isToday =
                date.getFullYear() === today.getFullYear() &&
                date.getMonth()    === today.getMonth()    &&
                date.getDate()     === today.getDate()
              return isToday
                ? { style: { backgroundColor: 'hsl(var(--accent) / 0.12)' } }
                : {}
            }}
          />
        </div>
      </CardContent>

      {/* Day popup — all events for a clicked day */}
      <Dialog open={!!dayPopup} onOpenChange={open => { if (!open) setDayPopup(null) }}>
        {dayPopup && (
          <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-base">
                {dayPopup.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </DialogTitle>
              <DialogDescription>{dayPopup.events.length} event{dayPopup.events.length !== 1 ? 's' : ''}</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {dayPopup.events.map((e, i) => {
                const ev  = e.resource
                const ipo = ipoMap.get(ev.ipo_id)
                return (
                  <div
                    key={i}
                    className="rounded-md border p-3 space-y-1.5 cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => { setDayPopup(null); setSelected(ev) }}
                  >
                    <div className="flex items-start gap-2">
                      {ipo && (
                        <span className="mt-1 h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: ipo.color_hex ?? '#94a3b8' }} />
                      )}
                      <p className="text-sm font-medium leading-snug">{ev.title}</p>
                    </div>
                    <div className="flex items-center gap-2 pl-4">
                      <Badge
                        variant="secondary"
                        className="text-xs"
                        style={{
                          backgroundColor: (STATUS_COLOR[ev.status] ?? '#94a3b8') + '22',
                          color:            STATUS_COLOR[ev.status] ?? '#94a3b8',
                        }}
                      >
                        {ev.status}
                      </Badge>
                      {ipo && <span className="text-xs text-muted-foreground">{ipo.name}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </DialogContent>
        )}
      </Dialog>

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
                  color:            STATUS_COLOR[selected.status] ?? '#94a3b8',
                  borderColor:     (STATUS_COLOR[selected.status] ?? '#94a3b8') + '44',
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
