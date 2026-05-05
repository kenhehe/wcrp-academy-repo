import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Guard: env vars must be present or skip auth entirely
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('[proxy] Missing Supabase env vars')
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })
  let user = null

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    console.error('[proxy] Supabase error:', err)
    // Fail open — let the page handle missing session
  }

  const isLoginRoute   = pathname === '/login'
  const isIpoRoute     = pathname.startsWith('/dashboard/ipo')
  const isAcademyRoute = pathname.startsWith('/dashboard/academy')

  // No session → force login (/ is the public summary board — allow through)
  if (!user && !isLoginRoute && pathname !== '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    const role        = user.app_metadata?.role as string | undefined
    const isDashboard = isIpoRoute || isAcademyRoute

    // Login page or root while authenticated → send to correct dashboard
    if (isLoginRoute || pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = role === 'academy_admin' ? '/dashboard/academy' : '/dashboard/ipo'
      return NextResponse.redirect(url)
    }

    // IPO user trying to access academy routes
    if (isAcademyRoute && role !== 'academy_admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard/ipo'
      return NextResponse.redirect(url)
    }

    void isDashboard
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
