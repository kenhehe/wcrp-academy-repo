import { Skeleton } from '@/components/ui/skeleton'

export default function GapsTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {['Event', 'IPO', 'Start', 'Status', 'Coverage'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }).map((_, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-4 py-3 max-w-sm">
                  <Skeleton className="h-4 w-56" />
                </td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                <td className="px-4 py-3"><Skeleton className="h-7 w-36 rounded-md" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
