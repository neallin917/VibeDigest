"use client"

import React, { createContext, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  DEFAULT_LOCALE,
  getBestLocaleFromNavigator,
  isLocale,
  type Locale,
  createTranslator,
} from "@/lib/i18n"

const STORAGE_KEY = "vd.locale"

type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children, locale: initialLocale }: { children: React.ReactNode, locale?: Locale }) {
  const router = useRouter()
  const pathname = usePathname()

  // Initialize with server-provided locale if available, effectively synching URL and UI
  const [locale, setLocaleState] = useState<Locale>(initialLocale || DEFAULT_LOCALE)

  // Load persisted locale after mount (client-only)
  useEffect(() => {
    let cancelled = false
    try {
      // Priority: 1. URL/Server (initialLocale passed prop) -> handled by useState default
      // 2. localStorage (user preference) - BUT only if we didn't get a specific URL locale?
      // Actually, standard behavior: URL overrides everything.
      // If we are at /zh, we show Chinese.
      // We should update localStorage to match the current URL locale if it differs.

      if (initialLocale && isLocale(initialLocale)) {
        window.localStorage.setItem(STORAGE_KEY, initialLocale)
      } else {
        // Fallback logic if no prop provided (legacy support)
        const stored = window.localStorage.getItem(STORAGE_KEY)
        const next = isLocale(stored) ? stored : getBestLocaleFromNavigator(window.navigator.language)
        Promise.resolve().then(() => {
          if (!cancelled && !initialLocale) setLocaleState(next)
        })
      }
    } catch {
      // ignore
    }
    return () => {
      cancelled = true
    }
  }, [initialLocale])

  // Sync document attributes
  useEffect(() => {
    try {
      document.documentElement.lang = locale
      document.documentElement.dir = locale === "ar" ? "rtl" : "ltr"
    } catch {
      // ignore
    }
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }

    // Update URL to match new locale
    if (pathname) {
      const segments = pathname.split('/')
      // Assuming URL structure is /:lang/:path*
      // segments[0] is empty, segments[1] is the locale
      if (segments.length > 1 && isLocale(segments[1])) {
        if (segments[1] !== next) {
          segments[1] = next
          router.push(segments.join('/'))
        }
      } else {
        // If URL doesn't have locale prefix (e.g. root /), rewrite with new locale?
        // Or maybe strictly append? This depends on middleware. 
        // For now, let's assume we are always in /[lang] structure if isLocale(segments[1]) is true.
        // If we are at root and isLocale(segments[1]) is false (e.g. /about), 
        // we might need to prepend.
      }
    }
  }, [pathname, router])

  const t = useMemo(() => createTranslator(locale), [locale])

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = React.useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>")
  return ctx
}


