'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { triggerScrape } from '../actions'

interface Props {
  ipoId:   string
  ipoName: string
}

export default function RunNowButton({ ipoId, ipoName }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      // force: a full run, the same as the preview dialog's "Force trigger"
      await triggerScrape(ipoId, true)
      toast.success(`${ipoName} run queued`)
    })
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={isPending}>
      {isPending ? <Loader2 className="animate-spin" /> : <Play />}
      Run now
    </Button>
  )
}
