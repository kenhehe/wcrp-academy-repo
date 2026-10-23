'use server'

import { requireCanApprove } from '@/lib/auth/guards'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export async function approveEvent(eventId: string) {
  await requireCanApprove()

  const db = createAdminClient()
  const { error } = await db
    .from('events')
    .update({ approval_status: 'approved' })
    .eq('id', eventId)
    .eq('approval_status', 'pending')

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/ipo/approvals')
}
