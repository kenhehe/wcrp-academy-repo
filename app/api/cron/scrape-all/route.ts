import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

const SCRAPERS = [
  'scrape-gewex',
  'scrape-cordex',
  'scrape-esmo',
  'scrape-rifs',
  'scrape-cmip',
  'scrape-clic',
  'scrape-clivar',
]

export async function GET() {
  // Vercel cron requests include this header automatically
  const headersList = await headers()
  const auth = headersList.get('authorization')

  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Missing SUPABASE env vars' }, { status: 500 })
  }

  // Fire all scrapers — each will run its own pre-check before deciding to scrape.
  // Do NOT await the responses; the Edge Functions run independently.
  for (const fn of SCRAPERS) {
    fetch(`${supabaseUrl}/functions/v1/${fn}`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ source: 'cron' }),
    }).catch(err => console.error(`[cron/scrape-all] ${fn} failed to invoke:`, err))
  }

  return NextResponse.json({
    ok:       true,
    fired:    SCRAPERS.length,
    scrapers: SCRAPERS,
    note:     'Each scraper will run its own freshness pre-check before scraping',
  })
}
