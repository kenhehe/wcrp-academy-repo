import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60  // seconds — enough for a single-page scrape

const FUNCTION_MAP: Record<string, string> = {
  gewex:  'scrape-gewex',
  cordex: 'scrape-cordex',
  esmo:   'scrape-esmo',
  rifs:   'scrape-rifs',
  cmip:   'scrape-cmip',
  clic:   'scrape-clic',
  clivar: 'scrape-clivar',
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ ipoId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ipoId } = await params
  const fnName    = FUNCTION_MAP[ipoId]
  if (!fnName) return NextResponse.json({ error: `No scraper for IPO: ${ipoId}` }, { status: 400 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey)
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })

  try {
    // Await this response — dry-run is a page-1 scrape, fast enough to fit in maxDuration
    const res = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ dry_run: true }),
    })

    if (!res.ok) {
      let errMsg: string
      try {
        const body = await res.json()
        errMsg = body.error ?? `Scraper returned HTTP ${res.status}`
      } catch {
        errMsg = `Scraper returned HTTP ${res.status}`
      }
      return NextResponse.json({ error: errMsg }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
