import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageInfo from '@/components/base/PageInfo'
import LighthouseAccountsTable from './_components/LighthouseAccountsTable'
import type { LighthouseUser } from './_components/LighthouseAccountsTable'

export const dynamic = 'force-dynamic'

const LIGHTHOUSE_IDS = ['de', 'epesc', 'gpex', 'mcr', 'rci', 'slc']

const LIGHTHOUSE_NAMES: Record<string, string> = {
  de:    'Digital Earths',
  epesc: 'EPESC — Explaining & Predicting ESC',
  gpex:  'GPEX — Global Precipitation EXperiment',
  mcr:   'My Climate Risk',
  rci:   'RCI — Research on Climate Intervention',
  slc:   'Safe Landing Climates',
}

export default async function LighthouseAccountsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.app_metadata?.can_approve) redirect('/dashboard/ipo')

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.listUsers()
  if (error) throw new Error(error.message)

  const users: LighthouseUser[] = data.users
    .filter(u =>
      u.app_metadata?.role === 'ipo_user' &&
      LIGHTHOUSE_IDS.includes(u.app_metadata?.org_id)
    )
    .map(u => {
      const orgId = u.app_metadata?.org_id as string
      return {
        id:         u.id,
        email:      u.email ?? '',
        org_id:     orgId,
        org_name:   LIGHTHOUSE_NAMES[orgId] ?? orgId,
        created_at: u.created_at,
      }
    })
    .sort((a, b) => a.org_id.localeCompare(b.org_id))

  return (
    <div className="p-8 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">LHA Accounts</h1>
          <PageInfo>
            Manage login credentials for each Lighthouse Activity programme.
            Each programme gets its own account so their team can submit events for approval.
          </PageInfo>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Manage access for Lighthouse Activity teams
        </p>
      </div>
      <LighthouseAccountsTable users={users} />
    </div>
  )
}
