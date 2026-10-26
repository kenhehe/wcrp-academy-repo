'use client'

// Open a draft, close an active survey, or reopen a closed one (page header)
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Lock, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { SurveyStatus } from '@/lib/data/surveys.types'
import { setSurveyStatus } from '../../actions'

const NEXT = {
  draft:  { to: 'active', label: 'Open the survey', icon: Play, title: 'Open this survey?',
    body: 'People can answer as soon as each survey window opens, through their personal links or the QR codes. The scheduled emails (Send tab) go out at their times once email sending is set up.' },
  active: { to: 'closed', label: 'Close the survey', icon: Lock, title: 'Close this survey?',
    body: 'Nobody can answer any more, even inside the windows, and emails still waiting are cancelled. You can reopen it later.' },
  closed: { to: 'active', label: 'Reopen', icon: RotateCcw, title: 'Reopen this survey?',
    body: 'People can answer again while the windows are open. Check the dates first if they have passed.' },
} as const

export default function SurveyStatusButton({ surveyId, status }: { surveyId: string; status: SurveyStatus }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const next = NEXT[status]
  const Icon = next.icon

  function confirm() {
    startTransition(async () => {
      try {
        const result = await setSurveyStatus(surveyId, next.to)
        if (!result.ok) { toast.error(result.error); return }
        toast.success(next.to === 'active' ? 'The survey is open' : 'The survey is closed')
        setOpen(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not change the survey')
      }
    })
  }

  return (
    <>
      <Button variant={status === 'draft' ? 'default' : 'outline'} onClick={() => setOpen(true)}>
        <Icon data-icon="inline-start" aria-hidden="true" />
        {next.label}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{next.title}</AlertDialogTitle>
            <AlertDialogDescription>{next.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirm} disabled={pending}>{pending ? 'One moment…' : next.label}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
