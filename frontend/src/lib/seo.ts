import { DEFAULT_LOCALE, LOCALE_DATE_TAG, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n"

export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.FRONTEND_URL ||
  "https://vibedigest.io"

const normalizePath = (path: string) => {
  if (!path || path === "/") return ""
  return path.startsWith("/") ? path : `/${path}`
}

export const buildLocalizedPath = (locale: string, path: string) => {
  const suffix = normalizePath(path)
  return `/${locale}${suffix}`
}

export const buildAlternateLanguages = (path: string) => {
  const suffix = normalizePath(path)
  const languages = Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [locale, `/${locale}${suffix}`])
  ) as Record<string, string>

  languages["x-default"] = `/${DEFAULT_LOCALE}${suffix}`
  return languages
}

export const getOpenGraphLocale = (locale: string) => {
  const tag = LOCALE_DATE_TAG[locale as Locale] || "en-US"
  return tag.replace("-", "_")
}
