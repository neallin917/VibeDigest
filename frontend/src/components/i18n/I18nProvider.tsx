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
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (isLocale(stored)) return stored
      return getBestLocaleFromNavigator(window.navigator.language)
    } catch {
      return DEFAULT_LOCALE
    }
  })

  useEffect(() => {
    try {
      document.documentElement.lang = locale
      document.documentElement.dir = locale === "ar" ? "rtl" : "ltr"
      window.localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      // ignore
    }
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
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


