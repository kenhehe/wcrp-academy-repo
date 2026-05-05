import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b px-8 py-4 flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-4 w-16" />
      </header>

      <main className="px-8 py-10 space-y-10 max-w-7xl mx-auto">

        {/* Global stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-3 w-20" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-14" /></CardContent>
            </Card>
          ))}
        </div>

        {/* Status + Year charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-4 w-32" /></CardHeader>
              <CardContent><Skeleton className="h-56 w-full" /></CardContent>
            </Card>
          ))}
        </div>

        {/* IPO comparison chart */}
        <Card>
          <CardHeader><Skeleton className="h-4 w-28" /></CardHeader>
          <CardContent><Skeleton className="h-56 w-full" /></CardContent>
        </Card>

        {/* IPO detail cards */}
        <section className="space-y-4">
          <Skeleton className="h-3 w-12" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-2.5 w-2.5 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="ml-auto h-3 w-12" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-6">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <div key={j} className="space-y-1">
                        <Skeleton className="h-6 w-8" />
                        <Skeleton className="h-3 w-14" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

      </main>
    </div>
  )
}
