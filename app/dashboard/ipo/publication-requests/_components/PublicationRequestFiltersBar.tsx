'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { groupOrgsByType, orgFullLabel } from '@/lib/data/org-groups'
import { Button } from '@/components/ui/button'

interface Ipo {
  id:        string
  name:      string
  full_name: string | null
  type:      string
}

interface Props {
  ipos:           Ipo[]
  activeChannel?: string
  activeIpo?:     string
}

export default function PublicationRequestFiltersBar({ ipos, activeChannel, activeIpo }: Props) {
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

  const hasActiveFilters = !!(activeChannel || activeIpo)

  return (
    <div className="flex items-center gap-3">
      <Select
        value={activeChannel ?? 'all'}
        onValueChange={v => { if (v != null) push('channel', v === 'all' ? undefined : v) }}
      >
        <SelectTrigger className="h-8 w-44 text-xs">
          <SelectValue placeholder="All channels" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All channels</SelectItem>
          <SelectItem value="social">Social media</SelectItem>
          <SelectItem value="website">Website article</SelectItem>
          <SelectItem value="newsletter">Newsletter</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={activeIpo ?? 'all'}
        onValueChange={v => { if (v != null) push('ipo', v === 'all' ? undefined : v) }}
      >
        <SelectTrigger className="h-8 w-44 text-xs">
          <SelectValue placeholder="All orgs" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All orgs</SelectItem>
          {groupOrgsByType(ipos).map(group => (
            <SelectGroup key={group.type}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.items.map(ipo => (
                <SelectItem key={ipo.id} value={ipo.id} title={orgFullLabel(ipo)}>{ipo.name}</SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
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
