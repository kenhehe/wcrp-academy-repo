'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, CheckCircle2 } from 'lucide-react'
import { triggerAllScrapers } from '../actions'

export default function RunAllButton() {
  const [isPending, startTransition] = useTransition()
  const [fired, setFired] = useState<number | null>(null)

  function handleClick() {
    startTransition(async () => {
      const result = await triggerAllScrapers()
      setFired(result.fired)
      setTimeout(() => setFired(null), 4000)
    })
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isPending}
      variant="outline"
      size="sm"
    >
      {isPending ? (
        <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Queuing…</>
      ) : fired !== null ? (
        <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-green-600" />{fired} scrapers queued</>
      ) : (
        <><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Run all scrapers</>
      )}
    </Button>
  )
}
