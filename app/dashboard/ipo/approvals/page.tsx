import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageInfo from '@/components/base/PageInfo'
import ApprovalsTable from './_components/ApprovalsTable'

export const dynamic = 'force-dynamic'

export default async function ApprovalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.app_metadata?.can_approve) redirect('/dashboard/ipo')

  // Use admin client so RLS doesn't restrict cross-org visibility
  const db = createAdminClient()

  const [{ data: pending }, { data: allOrgs }] = await Promise.all([
    db
      .from('events')
      .select('id,title,start_date,end_date,location,country,ipo_id,wants_social_media,wants_website_article,wants_newsletter')
      .eq('approval_status', 'pending')
      .order('start_date', { ascending: true }),
    // Unscoped by type — pending events can come from any org, not just LHAs
    db
      .from('ipos')
      .select('id,name,color_hex'),
  ])

  const ipoMap = new Map((allOrgs ?? []).map(i => [i.id, i]))

  const events = (pending ?? []).map(e => {
    const ipo = ipoMap.get(e.ipo_id)
    return {
      ...e,
      ipoName:  ipo?.name  ?? e.ipo_id,
      ipoColor: ipo?.color_hex ?? '#6b7280',
    }
  })

  return (
    <div className="p-8 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Approvals</h1>
          <PageInfo>
            Events awaiting your review before they appear on the WCRP community calendar —
            from IPO websites and Lighthouse Activity submissions alike.
          </PageInfo>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {events.length === 0
            ? 'No pending submissions'
            : `${events.length} event${events.length !== 1 ? 's' : ''} awaiting approval`
          }
        </p>
      </div>

      <ApprovalsTable events={events} />
    </div>
  )
}
