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
    gradient: string
    iconColor: string
    delay: number
    comingSoon?: boolean
    className?: string
}

function FeatureCard({ icon: Icon, title, desc, gradient, iconColor, delay, comingSoon, className = "" }: FeatureCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay, ease: "easeOut" }}
            className={cn(
                "group relative p-6 rounded-3xl overflow-hidden transition-all duration-500",
                // Light mode - cleaner glass
                "bg-white/40 backdrop-blur-xl border border-white/60 shadow-lg hover:shadow-xl hover:bg-white/60",
                // Dark mode - deep glass with glow
                "dark:bg-card/40 dark:backdrop-blur-xl dark:border-white/5 dark:hover:border-white/10 dark:hover:bg-card/60 dark:shadow-none",
                className
            )}
        >
            {/* Hover Gradient Spotlight */}
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-[0.05] dark:group-hover:opacity-[0.1] transition-opacity duration-500`} />
            
            {/* Ambient Corner Blob */}
            <div className={`absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br ${gradient} opacity-[0.1] dark:opacity-[0.15] blur-3xl rounded-full group-hover:scale-150 transition-transform duration-700 ease-out`} />

            <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                    <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-sm",
                        "bg-white border border-white/50",
                        "dark:bg-white/5 dark:border-white/10"
                    )}>
                        <Icon className={cn("w-6 h-6", iconColor)} />
                    </div>
                    
                    {comingSoon && (
                        <Badge variant="secondary" className="text-[10px] h-5 px-2 font-semibold border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                            Soon
                        </Badge>
                    )}
                </div>

                <Heading as="h3" className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:translate-x-1 transition-transform duration-300">
                    {title}
                </Heading>
                
                <Text className="text-slate-600 dark:text-zinc-400 leading-relaxed text-sm font-medium">
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
            gradient: "from-emerald-400 to-teal-500",
            iconColor: "text-emerald-400",
            className: "md:col-span-2 lg:col-span-2" // Large card
        },
        {
            icon: AlignLeft,
            title: t("landing.interactiveTranscript"),
            desc: t("landing.interactiveTranscriptDesc"),
            gradient: "from-blue-400 to-indigo-500",
            iconColor: "text-blue-400",
        },
        {
            icon: Languages,
            title: t("landing.crossLanguageAI"),
            desc: t("landing.crossLanguageAIDesc"),
            gradient: "from-orange-400 to-amber-500",
            iconColor: "text-orange-400",
        },
        {
            icon: Share2,
            title: t("landing.visualMindMaps"),
            desc: t("landing.visualMindMapsDesc"),
            gradient: "from-purple-400 to-pink-500",
            iconColor: "text-purple-400",
            className: "md:col-span-2 lg:col-span-2" // Large card
        },
        {
            icon: MessageSquare,
            title: t("landing.chatWithVideo"),
            desc: t("landing.chatWithVideoDesc"),
            gradient: "from-pink-400 to-rose-500",
            iconColor: "text-pink-400",
            comingSoon: true
        },
        {
            icon: Download,
            title: t("landing.seamlessExport"),
            desc: t("landing.seamlessExportDesc"),
            gradient: "from-indigo-400 to-cyan-500",
            iconColor: "text-indigo-400",
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
