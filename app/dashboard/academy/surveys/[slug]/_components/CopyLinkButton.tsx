'use client'

import { toast } from 'sonner'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CopyLinkButton({ url }: { url: string }) {
  return (
    <Button variant="ghost" size="sm" onClick={async () => {
      try {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied')
      } catch {
        toast.error('Couldn\'t copy: select the link and copy it by hand')
      }
    }}>
      <Copy data-icon="inline-start" aria-hidden="true" />
      Copy link
    </Button>
  )
}
