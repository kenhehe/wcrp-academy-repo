import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import IPOSidebar from '@/components/layout/IPOSidebar'
import ScrapeStatusBanner from './_components/ScrapeStatusBanner'

export default async function IPOLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId = user.app_metadata?.org_id as string | undefined
  if (!orgId) throw new Error(`User ${user.id} has no org_id in app_metadata`)

  const canApprove = user.app_metadata?.can_approve === true

  const admin = createAdminClient()

  const [{ data: ipo, error }, { data: lastRun }, { count: pendingCount }] = await Promise.all([
    supabase
      .from('ipos')
      .select('id, name, color_hex, type')
      .eq('id', orgId)
      .single(),
    supabase
      .from('scrape_runs')
      .select('id, started_at, status, error_message')
      .eq('ipo_id', orgId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Admin client needed — pending events span multiple lighthouse orgs
    canApprove
      ? admin.from('events').select('id', { count: 'exact', head: true }).eq('approval_status', 'pending')
      : Promise.resolve({ count: 0 }),
  ])

  if (error || !ipo) throw new Error(`IPO not found for org_id: ${orgId}`)

  const failedRun = lastRun?.status === 'failed' ? lastRun : null

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <IPOSidebar
        ipoId={ipo.id}
        ipoName={ipo.name}
        colorHex={ipo.color_hex ?? '#6b7280'}
        userEmail={user.email ?? ''}
        ipoType={ipo.type === 'lighthouse' ? 'lighthouse' : 'ipo'}
        canApprove={canApprove}
        pendingCount={pendingCount ?? 0}
      />
      <main className="flex-1 overflow-y-auto bg-muted/20">
        {failedRun && (
          <ScrapeStatusBanner
            runId={failedRun.id}
            startedAt={failedRun.started_at}
            errorMessage={failedRun.error_message}
            ipoName={ipo.name}
          />
        )}
        {children}
      </main>
    </div>
  )
}
