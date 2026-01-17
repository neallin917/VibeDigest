"use client"

import { useI18n } from "@/components/i18n/I18nProvider"
import { Heading, Text } from "@/components/ui/typography"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import {
    FileText,
    AlignLeft,
    Share2,
    Languages,
    MessageSquare,
    Download,
    LucideIcon
} from "lucide-react"

interface FeatureCardProps {
    icon: LucideIcon
    title: string
    desc: string
    color: string
    delay: number
    comingSoon?: boolean
    className?: string
}

function FeatureCard({ icon: Icon, title, desc, color, delay, comingSoon, className = "" }: FeatureCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay, ease: "easeOut" }}
            className={cn(
                "group relative p-6 rounded-2xl overflow-hidden transition-all duration-500",
                // Light mode
                "bg-white/60 backdrop-blur-xl border border-white/50 shadow-lg hover:shadow-xl hover:bg-white/80",
                // Dark mode
                "dark:bg-zinc-900/50 dark:border-white/5 dark:hover:border-white/10 dark:hover:bg-zinc-900/80 dark:shadow-none",
                className
            )}
        >
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${color} opacity-[0.08] dark:opacity-[0.03] group-hover:opacity-[0.15] dark:group-hover:opacity-[0.08] blur-2xl rounded-full transition-opacity duration-500`} />

            <div className="relative z-10">
                <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500 border",
                    "bg-slate-100 border-slate-200",
                    "dark:bg-white/5 dark:border-white/5"
                )}>
                    <Icon className={`w-5 h-5 ${color.replace('from-', 'text-').replace('to-', '')}`} />
                </div>

                <div className="flex items-center gap-2 mb-2">
                    <Heading as="h3" className="text-base font-bold text-slate-800 dark:text-zinc-100 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                        {title}
                    </Heading>
                    {comingSoon && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-medium border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                            Soon
                        </Badge>
                    )}
                </div>

                <Text className="text-slate-600 dark:text-zinc-400 leading-relaxed text-xs font-medium">
                    {desc}
                </Text>
            </div>
        </motion.div>
    )
}

export function FeaturesSection() {
    const { t } = useI18n()

    const features = [
        {
            icon: FileText,
            title: t("landing.smartSummarization"),
            desc: t("landing.smartSummarizationDesc"),
            color: "from-emerald-400 to-teal-500",
            className: "md:col-span-2 lg:col-span-2" // Large card
        },
        {
            icon: AlignLeft,
            title: t("landing.interactiveTranscript"),
            desc: t("landing.interactiveTranscriptDesc"),
            color: "from-blue-400 to-indigo-500",
        },
        {
            icon: Languages,
            title: t("landing.crossLanguageAI"),
            desc: t("landing.crossLanguageAIDesc"),
            color: "from-orange-400 to-amber-500",
        },
        {
            icon: Share2,
            title: t("landing.visualMindMaps"),
            desc: t("landing.visualMindMapsDesc"),
            color: "from-purple-400 to-pink-500",
            className: "md:col-span-2 lg:col-span-2" // Large card
        },
        {
            icon: MessageSquare,
            title: t("landing.chatWithVideo"),
            desc: t("landing.chatWithVideoDesc"),
            color: "from-pink-400 to-rose-500",
            comingSoon: true
        },
        {
            icon: Download,
            title: t("landing.seamlessExport"),
            desc: t("landing.seamlessExportDesc"),
            color: "from-indigo-400 to-cyan-500",
            comingSoon: true
        }
    ]

    return (
        <section id="features" className="py-20 px-6 relative scroll-mt-24">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-12 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <Heading as="h2" className="text-2xl md:text-4xl font-display font-bold mb-5 text-slate-900 dark:text-white">
                            Everything you need to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-emerald-400 dark:to-teal-400">learn faster</span>
                        </Heading>
                        <Text className="max-w-xl mx-auto text-slate-600 dark:text-zinc-400 text-base">
                            Transform passive watching into active understanding with our suite of AI-powered tools.
                        </Text>
                    </motion.div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                    {features.map((feature, index) => (
                        <FeatureCard
                            key={index}
                            {...feature}
                            delay={index * 0.1}
                        />
                    ))}
                </div>
            </div>
        </section>
    )
}
