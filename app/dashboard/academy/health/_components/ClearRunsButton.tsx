'use client'

import { useState, useTransition } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { deleteAllRuns } from '../actions'

const CONFIRM = 'delete records'

export default function ClearRunsButton() {
  const [open,      setOpen]      = useState(false)
  const [value,     setValue]     = useState('')
  const [isPending, startTransition] = useTransition()

  function close() { setOpen(false); setValue('') }

  function handleDelete() {
    startTransition(async () => {
      await deleteAllRuns()
      close()
    })
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Clear history
      </Button>

      <Dialog open={open} onOpenChange={o => { if (!o) close() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete all scrape run records?</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              This permanently removes all scrape history. The events in your database are
              not affected — only the run log is cleared.
            </p>
            <div className="space-y-2">
              <p className="text-sm">
                Type{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
                  {CONFIRM}
                </code>{' '}
                to confirm:
              </p>
              <Input
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder={CONFIRM}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && value === CONFIRM) handleDelete() }}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={close} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={value !== CONFIRM || isPending}
              onClick={handleDelete}
            >
              {isPending
                ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Deleting…</>
                : 'Delete all records'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
