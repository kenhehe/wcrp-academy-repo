import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageInfo from '@/components/base/PageInfo'
import PublicationRequestFiltersBar from './_components/PublicationRequestFiltersBar'
import PublicationRequestsTable from './_components/PublicationRequestsTable'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function PublicationRequestsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.app_metadata?.can_approve) redirect('/dashboard/ipo')

  const sp = await searchParams
  const channelFilter = typeof sp.channel === 'string' ? sp.channel : undefined
  const ipoFilter      = typeof sp.ipo     === 'string' ? sp.ipo     : undefined
  const page            = Math.max(1, parseInt(typeof sp.page === 'string' ? sp.page : '1'))

  // Admin client — spans every org, a plain session's RLS won't show that
  const db = createAdminClient()

  let query = db
    .from('events')
    .select('id,title,start_date,end_date,location,country,url,ipo_id,approval_status,wants_social_media,wants_website_article,wants_newsletter', { count: 'exact' })
    .order('start_date', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (channelFilter === 'social')          query = query.eq('wants_social_media', true)
  else if (channelFilter === 'website')    query = query.eq('wants_website_article', true)
  else if (channelFilter === 'newsletter') query = query.eq('wants_newsletter', true)
  else query = query.or('wants_social_media.eq.true,wants_website_article.eq.true,wants_newsletter.eq.true')

  if (ipoFilter) query = query.eq('ipo_id', ipoFilter)

  const [{ data: flagged, count }, { data: ipos }] = await Promise.all([
    query,
    // Unfiltered by type — unlike Approvals, this page spans both IPOs and LHAs
    db.from('ipos').select('id,name,color_hex').order('name'),
  ])

  const ipoMap = new Map((ipos ?? []).map(i => [i.id, i]))
  const events = (flagged ?? []).map(e => {
    const ipo = ipoMap.get(e.ipo_id)
    return {
      ...e,
      ipoName:  ipo?.name  ?? e.ipo_id,
      ipoColor: ipo?.color_hex ?? '#6b7280',
    }
  })

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  return (
    <div className="p-8 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Publication Requests</h1>
          <PageInfo>
            Every event where the organizer asked to be considered for social media, a website
            article, or the newsletter — across all IPOs and Lighthouse Activities, regardless of
            approval status. Purely informational: use it to prioritize what to communicate.
          </PageInfo>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {count ?? 0} flagged event{count === 1 ? '' : 's'}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <PublicationRequestFiltersBar
          ipos={(ipos ?? []).map(i => ({ id: i.id, name: i.name }))}
          activeChannel={channelFilter}
          activeIpo={ipoFilter}
        />
      </div>

      <PublicationRequestsTable events={events} page={page} totalPages={totalPages} sp={sp} />
    </div>
  )
}
