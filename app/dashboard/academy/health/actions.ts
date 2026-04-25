'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function triggerScrape(_: FormData, ipoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'academy_admin') {
    throw new Error('Unauthorized')
  }

  const { error } = await supabase
    .from('scrape_runs')
    .insert({ ipo_id: ipoId, status: 'queued', started_at: new Date().toISOString() })

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/academy/health')
}
