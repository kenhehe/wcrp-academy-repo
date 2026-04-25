'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import type { AcademyEventsFiltersProps } from './types'

export default function AcademyEventsFilters({
  statusOptions,
  typeOptions,
  yearOptions,
  activeStatus,
  activeType,
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
    router.replace(`${pathname}?${params.toString()}`)
  }

  const hasFilters = !!(activeStatus || activeType || activeYear)

  return (
    <div className="flex items-center gap-3">
      {statusOptions.length > 0 && (
        <Select
          value={activeStatus ?? 'all'}
          onValueChange={v => { if (v != null) push('status', v === 'all' ? undefined : v) }}
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statusOptions.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {typeOptions.length > 0 && (
        <Select
          value={activeType ?? 'all'}
          onValueChange={v => { if (v != null) push('type', v === 'all' ? undefined : v) }}
        >
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {typeOptions.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {yearOptions.length > 0 && (
        <Select
          value={activeYear ?? 'all'}
          onValueChange={v => { if (v != null) push('year', v === 'all' ? undefined : v) }}
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
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={() => router.replace(pathname)}
        >
          Clear
        </Button>
      )}
    </div>
  )
}
