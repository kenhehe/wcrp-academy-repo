import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Host-based gating for the Infomaniak router (wcrpacademy/wcrp-academy-host): one process
  // answers both dashboard.wcrp-academy.org and survey.wcrp-academy.org (host.config.json).
  // QR codes and survey links point at survey., so it only ever needs the participant pages,
  // the email cron route and the health check — never the admin dashboard.
  const host = request.headers.get('host') ?? ''
  const isSurveyHost = host.startsWith('survey.')
  const isSurveyAllowed = pathname.startsWith('/s/') || pathname === '/api/surveys/cron' || pathname === '/api/health'
  if (isSurveyHost && !isSurveyAllowed) {
    // Someone landing on the bare domain (no survey link) gets sent somewhere real, rather than a
    // blank 404 — but only the exact root: every other disallowed path (probing, /dashboard/*, …)
    // still gets a flat 404, so nothing here hints at what's behind the gate.
    if (pathname === '/') {
      return NextResponse.redirect('https://wcrp-academy.org')
    }
    return new NextResponse('Not found', { status: 404 })
  }

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
    // user stays null: protected paths redirect to /login below (fails closed); /, /login
    // and the token-authenticated public API still load
  }

  const isLoginRoute   = pathname === '/login'
  const isIpoRoute     = pathname.startsWith('/dashboard/ipo')
  const isAcademyRoute = pathname.startsWith('/dashboard/academy')
  // The public events API authenticates with its own Bearer token (api_tokens), not a session
  const isPublicApi    = pathname.startsWith('/api/v1/')
  // Survey participants have no login: /s/… checks a personal-link token or a signed cookie,
  // and the survey email cron route checks its own Bearer secret
  const isSurveyPublic = pathname.startsWith('/s/') || pathname === '/api/surveys/cron'
  // Polled by the router with no session at all (see app/api/health/route.ts)
  const isHealthCheck  = pathname === '/api/health'

  // No session → force login (/ is the public summary board — allow through)
  if (!user && !isLoginRoute && pathname !== '/' && !isPublicApi && !isSurveyPublic && !isHealthCheck) {
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
