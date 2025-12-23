"use client"

import React, { createContext, useCallback, useEffect, useMemo, useState } from "react"
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

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // IMPORTANT: keep SSR and first client render consistent to avoid hydration mismatch.
  // We intentionally start with DEFAULT_LOCALE, then sync from localStorage/navigator after mount.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  // Load persisted locale after mount (client-only)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (isLocale(stored)) {
        setLocaleState(stored)
        return
      }
      setLocaleState(getBestLocaleFromNavigator(window.navigator.language))
    } catch {
      // ignore
    }
  }, [])

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
  }, [])

  const t = useMemo(() => createTranslator(locale), [locale])

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = React.useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>")
  return ctx
}


