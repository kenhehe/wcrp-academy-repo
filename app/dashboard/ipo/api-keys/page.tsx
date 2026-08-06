import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageInfo from '@/components/base/PageInfo'
import ApiKeysTable from './_components/ApiKeysTable'
import type { ApiToken } from './_components/ApiKeysTable'

export const dynamic = 'force-dynamic'

export default async function ApiKeysPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.app_metadata?.can_approve) redirect('/dashboard/ipo')

  const db = createAdminClient()
  const { data, error } = await db
    .from('api_tokens')
    .select('id,name,token_prefix,created_at,last_used_at')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const tokens: ApiToken[] = data ?? []

  return (
    <div className="p-8 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">API Keys</h1>
          <PageInfo>
            Generate tokens to allow external systems (e.g. the WCRP website) to read
            approved events via the REST API. Tokens are shown once on creation — store
            them securely. Revoke a token at any time to immediately cut off access.
          </PageInfo>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Manage access tokens for the public events API
        </p>
      </div>

      <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm space-y-1">
        <p className="font-medium">API endpoint</p>
        <code className="text-xs text-muted-foreground">
          GET {process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'}/api/v1/events
        </code>
        <p className="text-xs text-muted-foreground pt-1">
          Pass your token as: <code>Authorization: Bearer &lt;token&gt;</code>
          <br />
          Optional filters: <code>?status=Upcoming</code> <code>?type=ipo</code> <code>?ipo=gewex</code>
        </p>
      </div>

      <ApiKeysTable tokens={tokens} />
    </div>
  )
}
