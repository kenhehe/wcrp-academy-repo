'use client'

// Add / edit / delete any org's event from Event Registry (academy_admin and can_approve).
// The server actions re-check the role; these only render on pages already gated to it.
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import EventForm from '@/components/events/EventForm'
import type { EventRow } from '@/components/events/EventForm/types'
import OrgDot from '@/components/base/OrgDot'
import { createEventForOrg, deleteAnyEvent, updateAnyEvent } from '@/lib/actions/admin-events'
import { HAND_ENTERED_SOURCES } from '@/lib/data/admin-events'
import type { AddEventButtonProps, RegistryRowActionsProps } from './types'

const GROUPS = [
  { type: 'ipo',        label: 'IPOs' },
  { type: 'lighthouse', label: 'Lighthouse Activities' },
]

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback)

export function AddEventButton({ orgs }: AddEventButtonProps) {
  const router = useRouter()
  const [open, setOpen]            = useState(false)
  const [pending, startTransition] = useTransition()
  const items = Object.fromEntries(orgs.map(org => [org.id, org.name]))

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        const { orgName, similar } = await createEventForOrg(formData)
        toast.success(`Added for ${orgName}. It's waiting in Approvals.`, {
          description: similar.length > 0
            ? `${similar[0].org} lists a similar event on this date ("${similar[0].title}"). If it's the same one, link them on the Duplicates page.`
            : undefined,
        })
        setOpen(false)
        router.refresh()
      } catch (err) {
        toast.error(errorMessage(err, 'Could not add the event'))
      }
    })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" aria-hidden="true" />
        Add event
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add event</DialogTitle>
            <DialogDescription>
              Add an event for any IPO or Lighthouse programme. It waits in Approvals before it appears on the public calendar.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="f-org">Organisation <span className="text-destructive">*</span></Label>
              <Select name="ipo_id" items={items} required>
                <SelectTrigger id="f-org" className="w-full sm:w-80">
                  <SelectValue placeholder="Choose an IPO or Lighthouse programme" />
                </SelectTrigger>
                <SelectContent>
                  {GROUPS.map(group => (
                    <SelectGroup key={group.type}>
                      <SelectLabel>{group.label}</SelectLabel>
                      {orgs.filter(org => org.type === group.type).map(org => (
                        <SelectItem key={org.id} value={org.id}>
                          <OrgDot color={org.color_hex} />
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <EventForm registryFields={[]} showPublicationFlags={false} showCustomFields={false} />
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add event'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function RegistryRowActions({ event, org }: RegistryRowActionsProps) {
  const router = useRouter()
  const [mode, setMode]            = useState<'edit' | 'delete' | null>(null)
  const [pending, startTransition] = useTransition()
  const orgName = org?.name ?? event.ipo_id
  const scraped = !HAND_ENTERED_SOURCES.includes(event.source ?? 'manual')

  const formEvent: EventRow = {
    ...event,
    source:       event.source ?? 'manual',
    extra_fields: null,
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await updateAnyEvent(formData)
        toast.success(`Saved changes to ${orgName}'s event`)
        setMode(null)
        router.refresh()
      } catch (err) {
        toast.error(errorMessage(err, 'Could not save the event'))
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteAnyEvent(event.id)
        toast.success('Event deleted')
        setMode(null)
        router.refresh()
      } catch (err) {
        toast.error(errorMessage(err, 'Could not delete the event'))
      }
    })
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon-sm" aria-label={`Edit "${event.title}"`} onClick={() => setMode('edit')}>
        <Pencil aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={`Delete "${event.title}"`} onClick={() => setMode('delete')}>
        <Trash2 aria-hidden="true" />
      </Button>

      {mode === 'edit' && (
        <Dialog open onOpenChange={next => !next && setMode(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit event</DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                <OrgDot color={org?.color_hex ?? null} />
                {orgName}. Its approval status and publication requests stay as they are.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdate}>
              <EventForm event={formEvent} registryFields={[]} showPublicationFlags={false} showCustomFields={false} />
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setMode(null)}>Cancel</Button>
                <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {mode === 'delete' && (
        <AlertDialog open onOpenChange={next => !next && setMode(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this event?</AlertDialogTitle>
              <AlertDialogDescription>
                <strong className="text-foreground">{event.title}</strong> ({orgName}, {event.start_date}) will be removed
                for everyone, including from the public calendar.
                {scraped && ` It comes from ${orgName}'s website, so it will come back on the next scrape unless ${orgName} removes it there.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setMode(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={pending}
              >
                {pending ? 'Deleting…' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
