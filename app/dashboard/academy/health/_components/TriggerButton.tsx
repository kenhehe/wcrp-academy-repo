'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { triggerScrape } from '../actions'

interface Props {
  ipoId: string
  force?: boolean
}

export default function TriggerButton({ ipoId, force = false }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      await triggerScrape(ipoId, force)
    })
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isPending}
      variant="outline"
      size="sm"
      className="h-7 text-xs"
    >
      {isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
      {isPending ? 'Queuing…' : force ? 'Force scrape' : 'Trigger'}
    </Button>
  )
}
