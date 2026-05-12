'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export async function markInAcademy(formData: FormData) {
  const id = formData.get('id') as string
  if (!id) return

  const supabase = createAdminClient()
  await supabase.from('events').update({ in_academy: true }).eq('id', id)

  revalidatePath('/dashboard/academy/gaps')
  revalidatePath('/dashboard/academy')
}
