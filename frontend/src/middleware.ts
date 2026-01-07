import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";

const locales = ["en", "zh", "es", "ar", "fr", "ru", "pt", "hi", "ja", "ko"];
const defaultLocale = "en";

function getLocale(request: NextRequest): string {
    const headers = { "accept-language": request.headers.get("accept-language") || "" };
    const languages = new Negotiator({ headers }).languages();
    return match(languages, locales, defaultLocale);
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. I18N Handling
    // Check if there is any supported locale in the pathname
    const pathnameHasLocale = locales.some(
        (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    );

    let currentLocale = defaultLocale;
    if (pathnameHasLocale) {
        // Extract existing locale (e.g., /en/dashboard -> en)
        const pathParts = pathname.split('/');
        if (pathParts.length > 1 && locales.includes(pathParts[1])) {
            currentLocale = pathParts[1];
        }
    } else {
        // Redirect if there is no locale
        const locale = getLocale(request);
        request.nextUrl.pathname = `/${locale}${pathname}`;

        // Use rewrite for default locale to avoid redirect latency
        if (locale === defaultLocale) {
            return NextResponse.rewrite(request.nextUrl);
        }
        return NextResponse.redirect(request.nextUrl);
    }

    // 2. Supabase Auth & Session Refresh
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()

    // 3. Protected Route Guards
    // Check logic using currentLocale to correct redirects

    // Guard: /dashboard
    if (pathname.includes('/dashboard')) {
        if (!user) {
            return NextResponse.redirect(new URL(`/${currentLocale}/login`, request.url))
        }
    }

    // Guard: /login (Redirect to dashboard if already logged in)
    if (pathname === `/${currentLocale}/login`) {
        if (user) {
            return NextResponse.redirect(new URL(`/${currentLocale}/dashboard`, request.url))
        }
    }

    return response
}

export const config = {
    matcher: [
        // Skip all internal paths (_next)
        // Skip all API routes (api)
        // Skip all static files (images, favicon, etc in public folder or with extension)
        // We only want to handle page routes
        '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
    ],
};
