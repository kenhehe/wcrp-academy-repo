import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listAcademyEvents, resolveStatus, CATALOGUE_PAGE_SIZE } from '@/lib/data/academy-events'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, PlusIcon, ExternalLinkIcon, PencilIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { deleteAcademyEventAction } from './actions'
import DeleteEventButton from './_components/DeleteEventButton'
import CatalogueFilters from './_components/CatalogueFilters'

export const dynamic = 'force-dynamic'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  'Upcoming training': 'default',
  'Ongoing training':  'secondary',
  'Past training':     'outline',
  'On Demand':         'secondary',
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function AcademyCataloguePage({ searchParams }: PageProps) {
  const sp     = await searchParams
  const search = typeof sp.search === 'string' ? sp.search : undefined
  const status = typeof sp.status === 'string' ? sp.status : undefined
  const page   = Math.max(1, parseInt(typeof sp.page === 'string' ? sp.page : '1'))

  const { data: events, count, error } = await listAcademyEvents({ search, status, page })
  const totalPages = Math.ceil((count ?? 0) / CATALOGUE_PAGE_SIZE)

  // status options for filter
  const supabase = await createClient()
  const { data: statusMeta } = await supabase
    .from('academy_events')
    .select('status')
  const statusOptions = [...new Set((statusMeta ?? []).map(r => r.status).filter(Boolean))].sort() as string[]
  if (!statusOptions.includes('On Demand')) statusOptions.push('On Demand')

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Academy Catalogue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {count ?? 0} events · full CRUD management
          </p>
        </div>
        <Link href="/dashboard/academy/catalogue/new" className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}>
          <PlusIcon className="h-4 w-4" />
          New event
        </Link>
      </div>

      <CatalogueFilters
        statusOptions={statusOptions}
        activeSearch={search}
        activeStatus={status}
      />

      {error ? (
        <p className="text-sm text-destructive">Failed to load events: {error.message}</p>
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
                <th className="px-4 py-3 text-left font-medium w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(events ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No events found{(search || status) ? ' for the selected filters' : ''}
                  </td>
                </tr>
              ) : (
                (events ?? []).map(row => {
                  const resolved = resolveStatus(row)
                  const isOnDemand = resolved === 'On Demand'
                  return (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 max-w-xs">
                        <p className="truncate font-medium">{row.title}</p>
                        {row.academy_id && (
                          <p className="text-xs text-muted-foreground">{row.academy_id}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[resolved] ?? 'outline'} className="text-xs whitespace-nowrap">
                          {resolved}
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
                        <div className="flex items-center gap-1">
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
                          <Link
                            href={`/dashboard/academy/catalogue/${row.id}/edit`}
                            className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                          </Link>
                          <DeleteEventButton
                            action={deleteAcademyEventAction}
                            eventId={row.id}
                            eventTitle={row.title}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} of {totalPages}</span>
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
            {page < totalPages ? (
              <Link href={`?${buildPageParams(sp, page + 1)}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'opacity-50 pointer-events-none')}>
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </div>
        </div>
      )}
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
