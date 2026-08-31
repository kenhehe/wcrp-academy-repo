'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

interface Ipo {
  id:   string
  name: string
}

interface Props {
  ipos:      Ipo[]
  activeIpo?: string
}

export default function DuplicateFiltersBar({ ipos, activeIpo }: Props) {
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

      {activeIpo && (
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
