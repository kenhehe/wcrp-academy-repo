'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export async function markAsExternal(formData: FormData) {
  const id = formData.get('id') as string
  if (!id) return

  const supabase = createAdminClient()
  await supabase.from('academy_events').update({ is_external: true }).eq('id', id)

  revalidatePath('/dashboard/academy/events')
  revalidatePath('/dashboard/academy')
}
