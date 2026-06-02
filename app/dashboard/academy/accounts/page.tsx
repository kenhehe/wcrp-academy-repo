import { createAdminClient } from '@/lib/supabase/admin'
import AccountsTable from '@/components/accounts/AccountsTable'
import PageInfo from '@/components/base/PageInfo'
import type { IPOUser } from '@/components/accounts/AccountsTable/types'
import { IPO_SOURCES } from '@/lib/ipo-sources'

export const dynamic = 'force-dynamic'

export default async function AccountsPage() {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.listUsers()

  if (error) throw new Error(error.message)

  const ipoUsers: IPOUser[] = data.users
    .filter(u => u.app_metadata?.role === 'ipo_user')
    .map(u => {
      const orgId = u.app_metadata?.org_id ?? ''
      const src   = IPO_SOURCES[orgId]
      return {
        id:           u.id,
        email:        u.email ?? '',
        org_id:       orgId,
        created_at:   u.created_at,
        source_type:  src?.type,
        source_label: src?.platform ?? src?.label,
        source_url:   src?.url,
      }
    })
    .sort((a, b) => a.org_id.localeCompare(b.org_id))

  return (
    <div className="p-8 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">IPO Accounts</h1>
          <PageInfo>Manage login credentials for each IPO team. Each IPO gets its own account with access limited to their own event catalogue. Use this page to invite new users or reset access.</PageInfo>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Manage login access for each IPO team
        </p>
      </div>
      <AccountsTable users={ipoUsers} />
    </div>
  )
}
