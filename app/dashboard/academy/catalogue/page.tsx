import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ExternalLinkIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchWpCatalogues, type WpCatalogueItem } from '@/lib/wordpress/client'
import { mapWpItem } from '@/lib/wordpress/mapper'
import CatalogueFilters from './_components/CatalogueFilters'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  'Upcoming training': 'default',
  'Ongoing training':  'secondary',
  'Past training':     'outline',
  'On Demand':         'secondary',
}

const ALL_STATUSES = ['Upcoming training', 'Ongoing training', 'Past training', 'On Demand']

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function AcademyCataloguePage({ searchParams }: PageProps) {
  const sp     = await searchParams
  const search = typeof sp.search === 'string' ? sp.search.toLowerCase() : undefined
  const status = typeof sp.status === 'string' ? sp.status : undefined
  const page   = Math.max(1, parseInt(typeof sp.page === 'string' ? sp.page : '1'))

  let error: string | null = null
  let allItems: WpCatalogueItem[] = []

  try {
    const { items } = await fetchWpCatalogues(page, PAGE_SIZE)
    allItems = items
  } catch (e) {
    error = String(e)
  }

  const mapped = allItems
    .map(mapWpItem)
    .filter(e => {
      if (search && !e.title.toLowerCase().includes(search)) return false
      if (status && e.status !== status) return false
      return true
    })

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Academy Catalogue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live from WordPress · {mapped.length} events
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-lg">
            Data is fetched directly from{' '}
            <a href="https://wcrp-academy.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors">
              wcrp-academy.org
            </a>{' '}
            via the WordPress REST API. Any changes made on the Academy website will reflect here automatically. This view is read-only — to edit an event, update it directly on the Academy site.
          </p>
        </div>
      </div>

      <CatalogueFilters
        statusOptions={ALL_STATUSES}
        activeSearch={search}
        activeStatus={status}
      />

      {error ? (
        <p className="text-sm text-destructive">Failed to load from WordPress: {error}</p>
      ) : (
        <div className="rounded-md border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Dates</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Lead Organizer</th>
                <th className="px-4 py-3 text-left font-medium w-16">Link</th>
              </tr>
            </thead>
            <tbody>
              {mapped.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No events found{(search || status) ? ' for the selected filters' : ''}
                  </td>
                </tr>
              ) : (
                mapped.map(row => {
                  const isOnDemand = row.status === 'On Demand'
                  return (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 max-w-xs">
                        <p className="truncate font-medium">{row.title}</p>
                        <p className="text-xs text-muted-foreground">WP #{row.id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[row.status ?? ''] ?? 'outline'} className="text-xs whitespace-nowrap">
                          {row.status ?? '—'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                        {isOnDemand
                          ? (row.publish_date ? `Published ${row.publish_date}` : '—')
                          : row.start_date
                            ? `${row.start_date}${row.end_date && row.end_date !== row.start_date ? ` → ${row.end_date}` : ''}`
                            : '—'
                        }
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {row.training_type ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px]">
                        <p className="truncate">{row.lead_organizer ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        {row.official_link && (
                          <a
                            href={row.official_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ExternalLinkIcon className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Page {page}</span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link href={`?${buildPageParams(sp, page - 1)}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          ) : (
            <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'opacity-50 pointer-events-none')}>
              <ChevronLeft className="h-4 w-4" />
            </span>
          )}
          <Link href={`?${buildPageParams(sp, page + 1)}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

function buildPageParams(sp: Record<string, string | string[] | undefined>, newPage: number): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'page') continue
    if (typeof v === 'string') params.set(k, v)
  }
  params.set('page', String(newPage))
  return params.toString()
}
