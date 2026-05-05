import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  )

  // Refresh session — must not run any logic between createServerClient and getUser
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
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
    const role       = user.app_metadata?.role as string | undefined
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
