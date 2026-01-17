"use client"

import { useI18n } from "@/components/i18n/I18nProvider"
import { TaskForm } from "@/components/dashboard/TaskForm"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export function HeroSection() {
    const { t } = useI18n()

    const renderWithBold = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g)
        return parts.map((part, index) => {
            if (part.startsWith("**") && part.endsWith("**")) {
                return <span key={index} className="text-indigo-600 dark:text-emerald-400 font-semibold drop-shadow-sm">{part.slice(2, -2)}</span>
            }
            return part
        })
    }

    return (
        <section id="hero" className="flex flex-col items-center justify-center px-6 pt-28 pb-16 md:pt-40 md:pb-24 text-center relative z-10 min-h-[85vh]">
            <div className="space-y-6 max-w-4xl relative">

                {/* Badge/Pill */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className={cn(
                        "inline-flex items-center gap-2 px-4 py-1.5 rounded-full backdrop-blur-sm shadow-sm mb-4",
                        "bg-indigo-50 border border-indigo-200/50",
                        "dark:bg-white/5 dark:border-white/10"
                    )}
                >
                    <span className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-medium text-indigo-700 dark:text-zinc-300 tracking-wide uppercase">AI-Powered Video Companion</span>
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
                    className="font-display text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.15]"
                >
                    {t("landing.titlePrefix")}{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400">
                        {t("landing.titleEmphasis")}
                    </span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                    className="max-w-xl mx-auto text-base md:text-lg leading-relaxed text-slate-600 dark:text-zinc-400 font-light"
                >
                    {renderWithBold(t("landing.smartSummarizationDesc"))}
                </motion.p>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                className="w-full max-w-lg z-20 mt-12 px-4"
            >
                <div className="relative group">
                    {/* Glow Effect */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 dark:from-emerald-500/20 dark:via-cyan-500/20 dark:to-teal-500/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition duration-1000" />
                    
                    {/* Input Container */}
                    <div className={cn(
                        "relative backdrop-blur-xl rounded-2xl p-2 ring-1 transition-all",
                        // Light mode
                        "bg-white/80 ring-slate-200/80 shadow-2xl shadow-indigo-500/10",
                        // Dark mode
                        "dark:bg-zinc-900/80 dark:ring-white/10 dark:shadow-none"
                    )}>
                        <TaskForm simple={true} />
                    </div>
                </div>

                <p className="mt-5 text-xs text-slate-500 dark:text-zinc-500">
                    Trusted by 10,000+ happy learners
                </p>
            </motion.div>
        </section>
    )
}
