import { Skeleton } from '@/components/ui/skeleton'

export default function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <Skeleton className="mx-auto h-8 w-56" />
          <Skeleton className="mx-auto h-4 w-40" />
        </div>
        <div className="rounded-lg border bg-background p-6 shadow-sm space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  )
}
