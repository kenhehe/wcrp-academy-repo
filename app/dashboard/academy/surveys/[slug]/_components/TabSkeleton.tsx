import { Skeleton } from '@/components/ui/skeleton'
import type { SurveyTabId } from './SurveyTabs'

// What each survey tab looks like while its data loads (shown by the Suspense in page.tsx)
export default function TabSkeleton({ tab }: { tab: SurveyTabId }) {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => <Skeleton key={i} className="h-11 w-full" />)

  if (tab === 'participants') {
    return (
      <div className="space-y-6">
        <Skeleton className="h-52 rounded-xl" />
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex gap-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-7 w-24" />)}</div>
          {rows(8)}
        </div>
      </div>
    )
  }
  if (tab === 'send') {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="h-28 rounded-xl" />
        <div className="space-y-3 rounded-xl border bg-card p-4">{rows(6)}</div>
      </div>
    )
  }
  if (tab === 'qr') {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map(i => (
          <div key={i} className="flex gap-5 rounded-xl border bg-card p-5">
            <Skeleton className="size-44 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-3"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-full" /><Skeleton className="h-8 w-48" /></div>
          </div>
        ))}
      </div>
    )
  }
  if (tab === 'results') {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-2/3" />
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="grid grid-cols-[18rem_1fr_7rem] items-center gap-6"><Skeleton className="h-8" /><Skeleton className="h-3" /><Skeleton className="h-5" /></div>
          ))}
        </div>
        <Skeleton className="h-52 rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-56 rounded-xl" /><Skeleton className="h-56 rounded-xl" /></div>
      </div>
    )
  }
  if (tab === 'export') {
    return <div className="grid gap-6 md:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
  }
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"><Skeleton className="h-96 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  )
}
