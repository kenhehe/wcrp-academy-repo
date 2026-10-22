import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

// Hash a raw token with SHA-256 — same function used when storing tokens
async function sha256(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function GET(req: NextRequest) {
  // --- Auth ---
  const authHeader = req.headers.get('authorization') ?? ''
  const raw = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  if (!raw) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 })
  }

  const db = createAdminClient()
  const hash = await sha256(raw)

  const { data: token, error: tokenError } = await db
    .from('api_tokens')
    .select('id')
    .eq('token_hash', hash)
    .single()

  if (tokenError || !token) {
    return NextResponse.json({ error: 'Invalid or revoked token' }, { status: 401 })
  }

  // Record last used — fire and forget
  db.from('api_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', token.id)

  // --- Filters ---
  const sp     = req.nextUrl.searchParams
  const status = sp.get('status')   // Upcoming | Ongoing | Past | Cancelled | Postponed
  const type   = sp.get('type')     // ipo | lighthouse
  const ipoId  = sp.get('ipo')      // gewex | cordex | … | de | mcr | …

  // --- Query ---
  const { data: ipos } = await db
    .from('ipos')
    .select('id, name, type')

  const ipoMap = new Map((ipos ?? []).map(i => [i.id, { name: i.name, type: i.type }]))

  // Approved events are past the 1000-row cap, so read every page
  let events: { id: string; title: string; start_date: string; end_date: string | null; status: string; location: string | null; country: string | null; url: string | null; ipo_id: string }[]
  try {
    events = await fetchAllRows('events query', (from, to) => {
      let query = db
        .from('events')
        .select('id,title,start_date,end_date,status,location,country,url,ipo_id')
        .eq('approval_status', 'approved')
        .order('start_date', { ascending: true })
        .order('id')
      if (status) query = query.eq('status', status)
      if (ipoId)  query = query.eq('ipo_id', ipoId)
      return query.range(from, to)
    })
  } catch (err) {
    console.error('[api/v1/events]', err)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }

  // Attach ipo_name + type; apply type filter here since it's on the ipos table
  const result = (events ?? [])
    .map(e => {
      const ipo = ipoMap.get(e.ipo_id)
      return {
        id:        e.id,
        title:     e.title,
        start_date: e.start_date,
        end_date:  e.end_date,
        status:    e.status,
        location:  e.location,
        country:   e.country,
        url:       e.url,
        ipo_id:    e.ipo_id,
        ipo_name:  ipo?.name ?? e.ipo_id,
        type:      ipo?.type ?? 'ipo',
      }
    })
    .filter(e => !type || e.type === type)

  return NextResponse.json({
    count: result.length,
    events: result,
  })
}
