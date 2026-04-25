import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AcademySidebar from '@/components/layout/AcademySidebar'

export default async function AcademyLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = user.app_metadata?.role
  if (role !== 'academy_admin') redirect('/dashboard/ipo')

  return (
    <div className="flex h-screen overflow-hidden">
      <AcademySidebar userEmail={user.email ?? ''} />
      <main className="flex-1 overflow-y-auto bg-muted/20">
        {children}
      </main>
    </div>
  )
}
