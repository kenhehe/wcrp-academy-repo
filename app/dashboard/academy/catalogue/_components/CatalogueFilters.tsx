'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { XIcon } from 'lucide-react'

interface Props {
  statusOptions: string[]
  activeSearch?: string
  activeStatus?: string
}

export default function CatalogueFilters({ statusOptions, activeSearch, activeStatus }: Props) {
  const router      = useRouter()
  const searchParams = useSearchParams()

  const push = useCallback((key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    if (value) params.set(key, value)
    else params.delete(key)
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  const clearAll = () => {
    router.replace('?', { scroll: false })
  }

  const hasFilters = !!(activeSearch || activeStatus)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="search"
        placeholder="Search by title…"
        defaultValue={activeSearch ?? ''}
        onChange={e => push('search', e.target.value || undefined)}
        className="h-8 w-52 text-sm"
      />

      <select
        value={activeStatus ?? ''}
        onChange={e => push('status', e.target.value || undefined)}
        className="h-8 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">All statuses</option>
        {statusOptions.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {hasFilters && (
        <Button variant="outline" size="sm" onClick={clearAll} className="h-8 gap-1 text-xs">
          <XIcon className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  )
}
