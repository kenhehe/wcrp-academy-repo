'use client'

import { useRef } from 'react'
import { CheckIcon } from 'lucide-react'
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  action: (formData: FormData) => Promise<void>
  eventId: string
}

export default function MarkInAcademyButton({ action, eventId }: Props) {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <>
      <form ref={formRef} action={action}>
        <input type="hidden" name="id" value={eventId} />
      </form>

      <Dialog>
        <DialogTrigger className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary active:bg-primary/10">
          <CheckIcon className="h-3 w-3" />
          Already in Academy
        </DialogTrigger>

        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Mark as already in Academy?</DialogTitle>
            <DialogDescription>
              Only use this if you are sure this event exists in the WCRP Academy
              catalogue but the system failed to suggest a match.
              <br /><br />
              This marks the event as covered{' '}
              <span className="font-medium text-foreground">without creating a direct link</span>{' '}
              to a specific Academy entry. Use &ldquo;Yes, same event&rdquo; instead whenever possible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="default"
              onClick={() => formRef.current?.requestSubmit()}
            >
              Yes, mark as covered
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
