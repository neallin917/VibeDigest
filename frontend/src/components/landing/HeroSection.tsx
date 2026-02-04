"use client"

import { useI18n } from "@/components/i18n/I18nProvider"
import { ChatInput } from "@/components/chat/ChatInput"
import { useRouter } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export function HeroSection() {
    const { t } = useI18n()
    const router = useRouter()

    const handleHeroSubmit = (text: string) => {
        // Save message for handoff
        localStorage.setItem('vibedigest_pending_message', text)
        // Redirect to chat
        router.push('/chat')
    }

    const renderWithBold = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g)
        return parts.map((part, index) => {
            if (part.startsWith("**") && part.endsWith("**")) {
                return <span key={index} className="text-emerald-700 dark:text-emerald-400 font-semibold drop-shadow-sm">{part.slice(2, -2)}</span>
            }
            return part
        })
    }

    return (
        <section id="hero" className="bg-noise flex flex-col items-center justify-center px-6 pt-28 pb-16 md:pt-40 md:pb-24 text-center relative z-10 min-h-[85vh]">
            <div className="space-y-6 max-w-4xl relative">

                {/* Badge/Pill */}
                <div
                    className={cn(
                        "inline-flex items-center gap-2 px-4 py-1.5 rounded-full backdrop-blur-md shadow-sm mb-6 transition-all hover:scale-105 cursor-default",
                        "bg-white/40 border border-white/60",
                        "dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]",
                        "animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out"
                    )}
                >
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                    </span>
                    <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 tracking-wide uppercase">AI-Powered Video Companion</span>
                </div>

                <h1
                    className="font-display text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.1] md:leading-[1.1] animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out fill-mode-backwards delay-100"
                >
                    {t("landing.titlePrefix")}{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-600 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-300 animate-pulse-glow">
                        {t("landing.titleEmphasis")}
                    </span>
                </h1>

                <p
                    className="max-w-xl mx-auto text-base md:text-lg leading-relaxed text-slate-600 dark:text-zinc-400 font-light animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out fill-mode-backwards delay-200"
                >
                    {renderWithBold(t("landing.smartSummarizationDesc"))}
                </p>
            </div>

            <div
                className="w-full max-w-2xl z-20 mt-12 px-4 animate-in fade-in slide-in-from-bottom-8 zoom-in-95 duration-1000 ease-out fill-mode-backwards delay-300"
            >
                <div className="relative group perspective-1000">
                    {/* Glow Effect */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600/20 via-teal-600/20 to-emerald-600/20 dark:from-emerald-500/20 dark:via-teal-500/20 dark:to-cyan-500/20 rounded-full blur-xl opacity-60 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />

                    {/* Input Container */}
                    <div className="relative">
                        <ChatInput 
                            variant="inline"
                            onSubmit={handleHeroSubmit}
                            showTypewriter={true}
                            hideDisclaimer={true}
                        />
                    </div>
                </div>

                <p className="mt-5 text-xs text-slate-500 dark:text-zinc-500">
                    Trusted by 10,000+ happy learners
                </p>
            </div>

            {/* Scroll Indicator */}
            <div
                className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-in fade-in delay-1000 duration-1000"
            >
                <ChevronDown className="w-6 h-6 text-slate-400 dark:text-zinc-500 animate-bounce" />
            </div>
        </section>
    )
}
