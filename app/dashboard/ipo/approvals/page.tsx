import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { must } from '@/lib/supabase/must'
import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/base/PageHeader'
import ApprovalsTable from './_components/ApprovalsTable'

export const dynamic = 'force-dynamic'

export default async function ApprovalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.app_metadata?.can_approve) redirect('/dashboard/ipo')

  // Use admin client so RLS doesn't restrict cross-org visibility
  const db = createAdminClient()

  const [pendingRes, allOrgsRes] = await Promise.all([
    db
      .from('events')
      .select('id,title,start_date,end_date,location,country,ipo_id')
      .eq('approval_status', 'pending')
      .order('start_date', { ascending: true }),
    // Unscoped by type — pending events can come from any org, not just LHAs
    db
      .from('ipos')
      .select('id,name,color_hex'),
  ])
  const pending = must('pending events query', pendingRes)
  const allOrgs = must('orgs query', allOrgsRes)

  const ipoMap = new Map((allOrgs ?? []).map(i => [i.id, i]))

  const events = (pending ?? []).map(e => {
    const ipo = ipoMap.get(e.ipo_id)
    return {
      ...e,
      ipoName:  ipo?.name  ?? e.ipo_id,
      ipoColor: ipo?.color_hex ?? 'var(--muted-foreground)',
    }
  })

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Approvals"
        info={
          <>
            Events awaiting your review before they appear on the WCRP community calendar —
            from IPO websites and Lighthouse Activity submissions alike.
          </>
        }
        description={
          events.length === 0
            ? 'No pending submissions'
            : `${events.length} event${events.length !== 1 ? 's' : ''} awaiting approval`
        }
      />

      <ApprovalsTable events={events} />
    </div>
  )
}
