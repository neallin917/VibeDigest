import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// i18n Configuration
const SUPPORTED_LOCALES = ["en", "zh", "es", "ar", "fr", "ru", "pt", "hi", "ja", "ko"]
const DEFAULT_LOCALE = "en"
const COOKIE_NAME = "vd_locale"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Route Strategy (i18n)
  let response: NextResponse

  // Check if pathname already has a locale
  const pathnameHasLocale = SUPPORTED_LOCALES.some(
      (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) {
      // Path is already correct, create base response
      response = NextResponse.next({
          request: {
              headers: request.headers,
          },
      })
  } else {
      // Need rewrite/redirect: Get locale from cookie or default
      let locale = DEFAULT_LOCALE
      const cookieLocale = request.cookies.get(COOKIE_NAME)?.value
      if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale)) {
          locale = cookieLocale
      }

      // Perform Rewrite (renders locale page while keeping URL clean if desired,
      // or aligns with previous proxy.ts logic which seemed to be doing rewrites)
      const url = request.nextUrl.clone()
      url.pathname = `/${locale}${pathname}`
      response = NextResponse.rewrite(url, {
          request: {
              headers: request.headers,
          }
      })
  }

  // 2. Auth Logic (Supabase)
  // Inject cookie operations into the response object
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Update Request Cookies (so Server Components get the new token)
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          // Update Response Cookies (so Browser gets the new token)
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 3. Refresh Token
  // This triggers setAll if the token needs refreshing
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    // Exclude static files, APIs, and Next.js internals
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
