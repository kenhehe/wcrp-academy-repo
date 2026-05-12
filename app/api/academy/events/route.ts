import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listAcademyEvents, createAcademyEvent } from '@/lib/data/academy-events'

// Roles allowed to write. Extend this array to open up access.
const WRITE_ROLES = ['academy_admin']

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp      = req.nextUrl.searchParams
  const search  = sp.get('search')  ?? undefined
  const status  = sp.get('status')  ?? undefined
  const page    = parseInt(sp.get('page') ?? '1')

  const { data, count, error } = await listAcademyEvents({ search, status, page })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, count, page })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!WRITE_ROLES.includes(user.app_metadata?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { data, error } = await createAcademyEvent(body)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
