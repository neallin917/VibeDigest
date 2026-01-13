"use client"

import { useI18n } from "@/components/i18n/I18nProvider"
import { TaskForm } from "@/components/dashboard/TaskForm"
import { motion } from "framer-motion"

export function HeroSection() {
    const { t } = useI18n()

    const renderWithBold = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g)
        return parts.map((part, index) => {
            if (part.startsWith("**") && part.endsWith("**")) {
                return <span key={index} className="text-emerald-400 font-semibold drop-shadow-sm">{part.slice(2, -2)}</span>
            }
            return part
        })
    }

    return (
        <section id="hero" className="flex flex-col items-center justify-center px-6 pt-32 pb-20 md:pt-48 md:pb-32 text-center relative z-10 min-h-[90vh]">
            <div className="space-y-8 max-w-5xl relative">

                {/* Badge/Pill */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm shadow-sm mb-4"
                >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-medium text-zinc-300 tracking-wide uppercase">AI-Powered Video Companion</span>
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
                    className="font-display text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-white leading-[1.1]"
                >
                    {t("landing.titlePrefix")}{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                        {t("landing.titleEmphasis")}
                    </span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                    className="max-w-2xl mx-auto text-lg md:text-xl leading-relaxed text-zinc-400 font-light"
                >
                    {renderWithBold(t("landing.smartSummarizationDesc"))}
                </motion.p>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                className="w-full max-w-xl z-20 mt-16 px-4"
            >
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-teal-500/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition duration-1000" />
                    <div className="relative bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl ring-1 ring-white/5">
                        <TaskForm simple={true} />
                    </div>
                </div>

                <p className="mt-6 text-sm text-zinc-500">
                    Trusted by 10,000+ happy learners
                </p>
            </motion.div>
        </section>
    )
}
