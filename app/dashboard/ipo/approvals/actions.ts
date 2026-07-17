'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function assertCanApprove() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  if (!user.app_metadata?.can_approve) throw new Error('Not authorised to approve events')
}

export async function approveEvent(eventId: string) {
  await assertCanApprove()

  const db = createAdminClient()
  const { error } = await db
    .from('events')
    .update({ approval_status: 'approved' })
    .eq('id', eventId)
    .eq('approval_status', 'pending')

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/ipo/approvals')
}
