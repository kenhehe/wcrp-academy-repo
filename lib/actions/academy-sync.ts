'use server'

// Runs the WordPress → academy_events sync now (it also runs daily on pg_cron). Shared by the
// Gap Analysis match dialog, the New survey page and Import / Export, so it lives here
// instead of a per-route actions.ts.
import { revalidatePath } from 'next/cache'
import { requireAcademyAdmin } from '@/lib/auth/guards'

interface SyncReply {
  message?: string
  synced?:  number
  skipped?: { wp_id: string; title: string; problems: string[] }[]
  error?:   string
}

const short = (title: string) => (title.length > 60 ? `${title.slice(0, 57)}…` : title)

// Awaits the sync response (unlike scraper triggers which fire-and-forget).
// Safe to await here — sync-academy-wp is fast (WP API fetch + DB upsert, ~3–10s).
export async function triggerAcademySync(): Promise<{ ok: boolean; message: string }> {
  await requireAcademyAdmin()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return { ok: false, message: 'Missing Supabase env vars' }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/sync-academy-wp`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
    })
    const json = await res.json() as SyncReply
    if (!res.ok) return { ok: false, message: json.error ?? `HTTP ${res.status}` }

    revalidatePath('/dashboard/academy', 'layout')
    const skipped = json.skipped ?? []
    const note = skipped.length === 0 ? '' : ` Skipped ${skipped.length}, fix on WordPress: ${
      skipped.map(s => `“${short(s.title)}” (${s.problems.join('; ')})`).join(', ')
    }.`
    return { ok: true, message: `Synced ${json.synced ?? 0} events from WordPress.${note}` }
  } catch (err) {
    return { ok: false, message: String(err) }
  }
}
