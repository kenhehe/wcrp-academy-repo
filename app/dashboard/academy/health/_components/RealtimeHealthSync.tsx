'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RealtimeHealthSync() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('scrape_runs_health')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scrape_runs' },
        () => router.refresh(),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [router])

  return null
}
