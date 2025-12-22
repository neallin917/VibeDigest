"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Check } from "lucide-react"

import { LOCALE_LABEL, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n"
import { useI18n } from "@/components/i18n/I18nProvider"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  align?: "left" | "right"
  size?: "sm" | "md"
}

export function LanguageDropdown({ className, align = "left", size = "md" }: Props) {
  const { locale, setLocale } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const currentLabel = useMemo(() => LOCALE_LABEL[locale], [locale])

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full rounded-md border border-white/10 bg-black/20 text-left text-sm",
          "focus:outline-none focus:ring-2 focus:ring-primary/40",
          "flex items-center justify-between gap-2",
          size === "sm" ? "h-9 px-3" : "h-11 px-4"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-2 min-w-[12rem] overflow-hidden rounded-xl border border-white/10",
            "bg-card/80 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.55)]",
            align === "right" ? "right-0" : "left-0"
          )}
          role="listbox"
          aria-label="Language"
        >
          <div className="py-2">
            {SUPPORTED_LOCALES.map((l) => {
              const active = l === locale
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => {
                    setLocale(l as Locale)
                    setOpen(false)
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-sm flex items-center justify-between gap-3",
                    "text-foreground/90 hover:bg-white/5",
                    active && "bg-primary/10 text-primary"
                  )}
                  role="option"
                  aria-selected={active}
                >
                  <span className="truncate">{LOCALE_LABEL[l]}</span>
                  {active ? <Check className="h-4 w-4" /> : <span className="h-4 w-4" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}


