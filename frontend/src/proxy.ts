import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { match } from '@formatjs/intl-localematcher'
import Negotiator from 'negotiator'
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, COOKIE_NAME } from './lib/i18n'

export default async function proxy(request: NextRequest) {
  // 1. Initialize response
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 2. Refresh Supabase Session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // This will refresh session if expired - required for Server Components
  await supabase.auth.getUser()

  // 3. Handle i18n Routing
  const pathname = request.nextUrl.pathname

  // Skip internal paths and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname.startsWith('/auth/callback') // Allow un-prefixed callback if it happens, though we fixed the redirect
  ) {
    return response
  }

  // Check if there is any supported locale in the pathname
  const pathnameIsMissingLocale = SUPPORTED_LOCALES.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  )

  // Redirect if there is no locale
  if (pathnameIsMissingLocale) {
    const locale = getLocale(request)

    // Redirect to the same path with locale prefix
    // e.g. /dashboard -> /en/dashboard
    return NextResponse.redirect(
      new URL(
        `/${locale}${pathname.startsWith('/') ? '' : '/'}${pathname}`,
        request.url
      )
    )
  }

  return response
}

function getLocale(request: NextRequest): string {
  // 1. Check cookie preference
  const cookieLocale = request.cookies.get(COOKIE_NAME)?.value
  if (
    cookieLocale &&
    SUPPORTED_LOCALES.includes(cookieLocale as (typeof SUPPORTED_LOCALES)[number])
  ) {
    return cookieLocale
  }

  // 2. Check Accept-Language header
  const headers = { 'accept-language': request.headers.get('accept-language') || '' }
  const languages = new Negotiator({ headers }).languages()

  try {
    return match(languages, SUPPORTED_LOCALES as unknown as string[], DEFAULT_LOCALE)
  } catch {
    return DEFAULT_LOCALE
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
