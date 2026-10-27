'use client'

// Pulls the Academy catalogue from WordPress now instead of waiting for the daily sync, then
// reloads the page's data. The toast lists any record WordPress needs fixing.
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { triggerAcademySync } from '@/lib/actions/academy-sync'
import type { SyncAcademyButtonProps } from './types'

export default function SyncAcademyButton({ label = 'Sync from WordPress', variant = 'outline', size = 'sm', className }: SyncAcademyButtonProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleSync() {
    startTransition(async () => {
      const result = await triggerAcademySync()
      if (!result.ok) { toast.error('Sync failed', { description: result.message }); return }
      toast.success(result.message)
      router.refresh()
    })
  }

  return (
    <Button type="button" variant={variant} size={size} disabled={pending} onClick={handleSync} className={className}>
      <RefreshCw data-icon="inline-start" aria-hidden="true" className={cn(pending && 'animate-spin')} />
      {pending ? 'Syncing…' : label}
    </Button>
  )
}
