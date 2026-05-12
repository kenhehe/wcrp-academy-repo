'use client'

import { useRef } from 'react'
import { Trash2 } from 'lucide-react'
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  action: (formData: FormData) => Promise<void>
  eventId: string
  eventTitle: string
}

export default function DeleteEventButton({ action, eventId, eventTitle }: Props) {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <>
      <form ref={formRef} action={action}>
        <input type="hidden" name="id" value={eventId} />
      </form>

      <Dialog>
        <DialogTrigger className="cursor-pointer inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </DialogTrigger>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete this event?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{eventTitle}</span>
              <br /><br />
              This will permanently remove the record from the Academy catalogue.
              Any IPO links to this event will also be broken. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={() => formRef.current?.requestSubmit()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
