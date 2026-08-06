import { Skeleton } from '@/components/ui/skeleton'

export default function ApiKeysLoading() {
  return (
    <div className="p-8 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-20 w-full rounded-lg" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="rounded-md border">
        <div className="divide-y">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-4 w-20 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
