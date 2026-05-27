'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import ScrapePreviewDialog from './ScrapePreviewDialog'

interface Props {
  ipoId:   string
  ipoName: string
}

export default function TriggerButton({ ipoId, ipoName }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        size="sm"
        className="h-7 text-xs"
      >
        Trigger
      </Button>

      <ScrapePreviewDialog
        ipoId={ipoId}
        ipoName={ipoName}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
