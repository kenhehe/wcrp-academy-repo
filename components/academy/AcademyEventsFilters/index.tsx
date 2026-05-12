'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import type { AcademyEventsFiltersProps } from './types'

const MATCH_OPTIONS = [
  { value: 'matched',      label: 'Matched' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'external',     label: 'Not IPO events' },
]

export default function AcademyEventsFilters({
  yearOptions,
  activeMatch,
  activeYear,
}: AcademyEventsFiltersProps) {
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

  const hasFilters = !!(activeMatch || activeYear)

  return (
    <div className="flex items-center gap-3">
      <Select
        value={activeMatch ?? 'all'}
        onValueChange={v => push('match', v === 'all' ? undefined : v ?? undefined)}
      >
        <SelectTrigger className="h-8 w-40 text-xs">
          <SelectValue placeholder="All events" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All events</SelectItem>
          {MATCH_OPTIONS.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {yearOptions.length > 0 && (
        <Select
          value={activeYear ?? 'all'}
          onValueChange={v => push('year', v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue placeholder="All years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {yearOptions.map(y => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasFilters && (
        <Button
          variant="destructive"
          size="sm"
          className="h-8 text-xs"
          onClick={() => router.replace(pathname, { scroll: false })}
        >
          Clear
        </Button>
      )}
    </div>
  )
}
