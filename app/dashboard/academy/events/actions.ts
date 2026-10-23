'use server'

import { requireAcademyAdmin } from '@/lib/auth/guards'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export async function markAsExternal(formData: FormData) {
  await requireAcademyAdmin()
  const id = formData.get('id') as string
  if (!id) return

  const supabase = createAdminClient()
  await supabase.from('academy_events').update({ is_external: true }).eq('id', id)

  revalidatePath('/dashboard/academy/events')
  revalidatePath('/dashboard/academy')
}
