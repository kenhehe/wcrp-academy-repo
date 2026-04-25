import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import IPOSidebar from '@/components/layout/IPOSidebar'

export default async function IPOLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId = user.app_metadata?.org_id as string | undefined
  if (!orgId) throw new Error(`User ${user.id} has no org_id in app_metadata`)

  const { data: ipo, error } = await supabase
    .from('ipos')
    .select('id, name, color_hex')
    .eq('id', orgId)
    .single()

  if (error || !ipo) throw new Error(`IPO not found for org_id: ${orgId}`)

  return (
    <div className="flex h-screen overflow-hidden">
      <IPOSidebar
        ipoId={ipo.id}
        ipoName={ipo.name}
        colorHex={ipo.color_hex ?? '#6b7280'}
        userEmail={user.email ?? ''}
      />
      <main className="flex-1 overflow-y-auto bg-muted/20">
        {children}
      </main>
    </div>
  )
}
