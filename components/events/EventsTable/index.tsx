'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { createEvent, updateEvent, deleteEvent } from '@/app/dashboard/ipo/events/actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import EventForm from '@/components/events/EventForm'
import type { EventRow, RegistryField, ActiveFilters } from './types'
import { STATUS_OPTIONS, PAGE_SIZE } from './types'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  Upcoming: 'default',
  Ongoing:  'secondary',
  Past:     'outline',
}

type Modal =
  | { type: 'create' }
  | { type: 'edit'; event: EventRow }
  | { type: 'delete'; event: EventRow }
  | null

interface EventsTableProps {
  events:         EventRow[]
  totalCount:     number
  page:           number
  registryFields: RegistryField[]
  availableYears: number[]
  activeFilters:  ActiveFilters
}

export default function EventsTable({
  events,
  totalCount,
  page,
  registryFields,
  availableYears,
  activeFilters,
}: EventsTableProps) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [modal, setModal]           = useState<Modal>(null)
  const [pending, startTransition]  = useTransition()

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  function pushParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '') params.delete(k)
      else params.set(k, v)
    }
    params.delete('page')
    router.replace(`${pathname}?${params.toString()}`)
  }

  function setPage(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(p))
    router.replace(`${pathname}?${params.toString()}`)
  }

  function close() { setModal(null) }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    startTransition(async () => {
      try {
        await createEvent(new FormData(e.currentTarget))
        toast.success('Event created')
        close()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create event')
      }
    })
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    startTransition(async () => {
      try {
        await updateEvent(new FormData(e.currentTarget))
        toast.success('Event updated')
        close()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update event')
      }
    })
  }

  function handleDelete(eventId: string) {
    startTransition(async () => {
      try {
        await deleteEvent(eventId)
        toast.success('Event deleted')
        close()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete event')
      }
    })
  }

  const hasActiveFilters = Object.values(activeFilters).some(Boolean)

  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Status */}
        <Select
          value={activeFilters.status ?? '__all__'}
          onValueChange={v => pushParams({ status: v === '__all__' ? null : v })}
        >
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Year */}
        <Select
          value={activeFilters.year ?? '__all__'}
          onValueChange={v => pushParams({ year: v === '__all__' ? null : v })}
        >
          <SelectTrigger className="w-28 h-8 text-sm">
            <SelectValue placeholder="All years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All years</SelectItem>
            {availableYears.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Dynamic filters from ipo_field_registry */}
        {registryFields.map(field => {
          if (!field.values?.length) return null
          const paramKey = `field_${field.field_key}`
          const label    = field.label ?? field.field_key.replace(/_/g, ' ')
          return (
            <Select
              key={field.field_key}
              value={activeFilters[paramKey] ?? '__all__'}
              onValueChange={v => pushParams({ [paramKey]: v === '__all__' ? null : v })}
            >
              <SelectTrigger className="w-36 h-8 text-sm capitalize">
                <SelectValue placeholder={`All ${label}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All {label}</SelectItem>
                {field.values.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          )
        })}

        {hasActiveFilters && (
          <button
            onClick={() => pushParams(
              Object.fromEntries(Object.keys(activeFilters).map(k => [k, null]))
            )}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Clear filters
          </button>
        )}

        <div className="ml-auto">
          <Button size="sm" onClick={() => setModal({ type: 'create' })}>
            <Plus className="h-4 w-4 mr-2" />
            Add event
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-background overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-64">Title</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Country</TableHead>
              {registryFields.map(f => (
                <TableHead key={f.field_key} className="capitalize">
                  {f.label ?? f.field_key.replace(/_/g, ' ')}
                </TableHead>
              ))}
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 && (
              <TableRow>
                <TableCell colSpan={7 + registryFields.length} className="text-center text-muted-foreground py-12">
                  No events match the current filters
                </TableCell>
              </TableRow>
            )}
            {events.map(event => (
              <TableRow key={event.id} className="group">
                <TableCell className="font-medium">
                  {event.url ? (
                    <a
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="line-clamp-2 leading-snug hover:underline hover:text-primary transition-colors"
                    >
                      {event.title}
                    </a>
                  ) : (
                    <span className="line-clamp-2 leading-snug">{event.title}</span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums text-sm">{event.start_date}</TableCell>
                <TableCell className="tabular-nums text-sm text-muted-foreground">
                  {event.end_date ?? '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[event.status] ?? 'outline'} className="text-xs">
                    {event.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{event.location ?? '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{event.country ?? '—'}</TableCell>
                {registryFields.map(f => (
                  <TableCell key={f.field_key} className="text-sm text-muted-foreground">
                    {event.extra_fields?.[f.field_key] ?? '—'}
                  </TableCell>
                ))}
                <TableCell>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setModal({ type: 'edit', event })}
                      className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setModal({ type: 'delete', event })}
                      className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>{totalCount} events · page {page} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create modal */}
      <Dialog open={modal?.type === 'create'} onOpenChange={open => !open && close()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add event</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <EventForm registryFields={registryFields} />
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Creating…' : 'Create event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      {modal?.type === 'edit' && (
        <Dialog open onOpenChange={open => !open && close()}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit event</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdate}>
              <EventForm event={modal.event} registryFields={registryFields} />
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={close}>Cancel</Button>
                <Button type="submit" disabled={pending}>
                  {pending ? 'Saving…' : 'Save changes'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirm */}
      {modal?.type === 'delete' && (
        <AlertDialog open onOpenChange={open => !open && close()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete event?</AlertDialogTitle>
              <AlertDialogDescription>
                <strong className="text-foreground">{modal.event.title}</strong> will be permanently
                removed. If it was scraped, it will reappear on the next scrape run.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={close}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDelete(modal.event.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={pending}
              >
                {pending ? 'Deleting…' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}
