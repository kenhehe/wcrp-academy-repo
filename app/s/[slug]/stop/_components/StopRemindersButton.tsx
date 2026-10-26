'use client'

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { stopReminders } from '@/app/s/actions'

export default function StopRemindersButton({ slug, token }: { slug: string; token: string }) {
  const [done, setDone]   = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (done) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2.5 text-sm text-success">
        <Check className="size-4" aria-hidden="true" />
        Done: no more reminders about this survey.
      </p>
    )
  }
  return (
    <div className="space-y-2">
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button className="h-12 w-full text-base" disabled={pending} onClick={() => startTransition(async () => {
        const result = await stopReminders(slug, token)
        if (result.ok) setDone(true)
        else setError(result.error)
      })}>
        {pending ? 'One moment…' : 'Stop reminders'}
      </Button>
    </div>
  )
}
