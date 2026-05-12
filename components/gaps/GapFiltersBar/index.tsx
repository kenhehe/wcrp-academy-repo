'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

interface Ipo {
  id: string
  name: string
}

interface GapFiltersBarProps {
  ipos:        Ipo[]
  activeIpo?:  string
  activeStatus?: string
}

export default function GapFiltersBar({ ipos, activeIpo, activeStatus }: GapFiltersBarProps) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  function push(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    if (value) params.set(key, value)
    else        params.delete(key)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const hasFilters = !!(activeIpo || activeStatus)

  return (
    <div className="flex items-center gap-3">
      <Select
        value={activeIpo ?? 'all'}
        onValueChange={v => { if (v != null) push('ipo', v === 'all' ? undefined : v) }}
      >
        <SelectTrigger className="h-8 w-44 text-xs">
          <SelectValue placeholder="All IPOs" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All IPOs</SelectItem>
          {ipos.map(ipo => (
            <SelectItem key={ipo.id} value={ipo.id}>{ipo.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={activeStatus ?? 'all'}
        onValueChange={v => { if (v != null) push('status', v === 'all' ? undefined : v) }}
      >
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="Upcoming">Upcoming</SelectItem>
          <SelectItem value="Ongoing">Ongoing</SelectItem>
          <SelectItem value="Past">Past</SelectItem>
          <SelectItem value="Cancelled">Cancelled</SelectItem>
          <SelectItem value="Postponed">Postponed</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={() => router.replace(pathname, { scroll: false })}
        >
          Clear
        </Button>
      )}
    </div>
  )
}
