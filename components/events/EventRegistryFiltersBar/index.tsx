'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, Loader2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { STATUS_OPTIONS } from '../EventRegistryBrowser/types'
import type { RegistryOrg } from '../EventRegistryBrowser/types'

interface Props {
  orgs:           RegistryOrg[]
  activeQuery?:   string
  activeIpo?:     string
  activeStatus?:  string
  activeYear?:    string
  years:          number[]
  children:       React.ReactNode
}

export default function EventRegistryFiltersBar({ orgs, activeQuery, activeIpo, activeStatus, activeYear, years, children }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const [query, setQuery]           = useState(activeQuery ?? '')
  const [isPending, startTransition] = useTransition()

  // Debounced search — types into the box, waits, then updates the URL (which
  // re-triggers the server query). Wrapped in startTransition so React keeps
  // the old table mounted (dimmed below) instead of flashing the Suspense
  // fallback on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('page')
      if (query.trim()) params.set('q', query.trim())
      else               params.delete('q')
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  function push(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    if (value) params.set(key, value)
    else        params.delete(key)
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  const hasActiveFilters = !!(query || activeIpo || activeStatus || activeYear)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by title…"
            className="h-8 w-56 rounded-md border bg-background pl-8 pr-8 text-xs outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
          {isPending && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>

        <Select
          value={activeIpo ?? 'all'}
          onValueChange={v => { if (v != null) push('ipo', v === 'all' ? undefined : v) }}
        >
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="All orgs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All orgs</SelectItem>
            {orgs.map(org => (
              <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
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
            {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select
          value={activeYear ?? 'all'}
          onValueChange={v => { if (v != null) push('year', v === 'all' ? undefined : v) }}
        >
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue placeholder="All years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="destructive"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setQuery('')
              startTransition(() => router.replace(pathname, { scroll: false }))
            }}
          >
            Clear
          </Button>
        )}
      </div>

      <div className={cn('transition-opacity', isPending && 'opacity-60 pointer-events-none')}>
        {children}
      </div>
    </div>
  )
}
