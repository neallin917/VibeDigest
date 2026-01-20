import { NextResponse, type NextRequest } from 'next/server'

// Minimal set of supported locales to avoid importing the whole i18n module
const SUPPORTED_LOCALES = ["en", "zh", "es", "ar", "fr", "ru", "pt", "hi", "ja", "ko"]
const DEFAULT_LOCALE = "en"
const COOKIE_NAME = "vd_locale"

export default function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    // 1. Skip public files and API routes
    if (
        pathname.startsWith('/api') ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/static') ||
        pathname.includes('.') // images, favicon, etc.
    ) {
        return NextResponse.next()
    }

    // 2. check if pathname already has a locale
    const pathnameHasLocale = SUPPORTED_LOCALES.some(
        (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    )

    if (pathnameHasLocale) {
        return NextResponse.next()
    }

    // 3. Get locale from cookie
    let locale = DEFAULT_LOCALE
    const cookieLocale = request.cookies.get(COOKIE_NAME)?.value
    if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale)) {
        locale = cookieLocale
    }

    // 4. Rewrite the request to the locale-prefixed path
    // e.g. /chat -> /en/chat
    return NextResponse.rewrite(
        new URL(`/${locale}${pathname}`, request.url)
    )
}

export const config = {
    matcher: [
        // Skip all internal paths (_next)
        // Skip all API routes (api)
        // Skip all static files (images, favicon, etc in public folder or with extension)
        // We only want to handle page routes
        '/((?!api|lg|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
    ],
};
