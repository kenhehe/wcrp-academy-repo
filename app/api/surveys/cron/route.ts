import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runDueJobs } from '@/lib/surveys/email/send'

// Called every 10 minutes by pg_cron (supabase/migrations/20261026_survey_email_cron.sql) to
// send the survey emails that are due. Authenticates with its own Bearer secret
// (SURVEYS_CRON_SECRET), so proxy.ts lets it through without a session.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorised(req: NextRequest): boolean {
  const secret = process.env.SURVEYS_CRON_SECRET
  if (!secret || secret.length < 32) throw new Error('SURVEYS_CRON_SECRET is missing or shorter than 32 characters')
  const given = Buffer.from(req.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function POST(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await runDueJobs(createAdminClient()))
  } catch (err) {
    console.error('[surveys cron]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Survey email run failed' }, { status: 500 })
  }
}
