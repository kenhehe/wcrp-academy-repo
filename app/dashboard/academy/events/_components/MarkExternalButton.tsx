'use client'

import { useRef } from 'react'
import { BanIcon } from 'lucide-react'
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  action: (formData: FormData) => Promise<void>
  eventId: string
}

export default function MarkExternalButton({ action, eventId }: Props) {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <>
      <form ref={formRef} action={action}>
        <input type="hidden" name="id" value={eventId} />
      </form>

      <Dialog>
        <DialogTrigger className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground shadow-sm transition-colors hover:border-muted-foreground hover:text-foreground active:bg-muted">
          <BanIcon className="h-3 w-3" />
          Not an IPO event
        </DialogTrigger>

        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Mark as not an IPO event?</DialogTitle>
            <DialogDescription>
              Use this only if you are certain this event was sourced outside of
              the 7 IPOs — for example, from a partner organisation or external body.
              <br /><br />
              Once marked, this event will be{' '}
              <span className="font-medium text-foreground">excluded from coverage calculations</span>{' '}
              and will no longer appear as needing a match.
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
              Yes, mark as external
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
