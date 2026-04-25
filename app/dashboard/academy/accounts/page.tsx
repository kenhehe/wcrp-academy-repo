import { createAdminClient } from '@/lib/supabase/admin'
import AccountsTable from '@/components/accounts/AccountsTable'
import type { IPOUser } from '@/components/accounts/AccountsTable/types'

export const dynamic = 'force-dynamic'

export default async function AccountsPage() {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.listUsers()

  if (error) throw new Error(error.message)

  const ipoUsers: IPOUser[] = data.users
    .filter(u => u.app_metadata?.role === 'ipo_user')
    .map(u => ({
      id:         u.id,
      email:      u.email ?? '',
      org_id:     u.app_metadata?.org_id ?? '',
      created_at: u.created_at,
    }))
    .sort((a, b) => a.org_id.localeCompare(b.org_id))

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">IPO Accounts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage login access for each IPO team
        </p>
      </div>
      <AccountsTable users={ipoUsers} />
    </div>
  )
}
