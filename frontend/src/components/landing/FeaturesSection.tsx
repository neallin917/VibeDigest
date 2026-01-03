"use client"

import { useI18n } from "@/components/i18n/I18nProvider"
import { Heading, Text } from "@/components/ui/typography"
import { Badge } from "@/components/ui/badge"
import {
    FileText,
    AlignLeft,
    Share2,
    Languages,
    MessageSquare,
    Download
} from "lucide-react"

export function FeaturesSection() {
    const { t } = useI18n()

    const features = [
        {
            icon: FileText,
            title: t("landing.smartSummarization"),
            desc: t("landing.smartSummarizationDesc"),
            color: "text-emerald-400"
        },
        {
            icon: AlignLeft,
            title: t("landing.interactiveTranscript"),
            desc: t("landing.interactiveTranscriptDesc"),
            color: "text-blue-400"
        },
        {
            icon: Languages,
            title: t("landing.crossLanguageAI"),
            desc: t("landing.crossLanguageAIDesc"),
            color: "text-orange-400"
        },
        {
            icon: Share2,
            title: t("landing.visualMindMaps"),
            desc: t("landing.visualMindMapsDesc"),
            color: "text-purple-400"
        },
        {
            icon: MessageSquare,
            title: t("landing.chatWithVideo"),
            desc: t("landing.chatWithVideoDesc"),
            color: "text-pink-400",
            comingSoon: true
        },
        {
            icon: Download,
            title: t("landing.seamlessExport"),
            desc: t("landing.seamlessExportDesc"),
            color: "text-indigo-400",
            comingSoon: true
        }
    ]

    return (
        <section className="py-16 px-4 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="text-center mb-12 relative z-10">
                <Heading as="h2" className="text-2xl md:text-3xl font-bold mb-4">
                    Everything you need to <span className="text-primary">learn faster</span>
                </Heading>
                <Text className="max-w-xl mx-auto text-muted-foreground text-base">
                    {t("landing.smartSummarizationDesc")}
                </Text>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto relative z-10">
                {features.map((feature, index) => (
                    <div key={index} className="group p-6 rounded-2xl bg-card border border-white/5 hover:border-white/10 hover:bg-[#1A1A1A] transition-all duration-300">
                        <div className={`w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 ${feature.color}`}>
                            <feature.icon className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-3 mb-2">
                            <Heading as="h3" className="text-lg font-bold text-foreground">
                                {feature.title}
                            </Heading>
                            {feature.comingSoon && (
                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-medium border-white/10 bg-white/5 text-muted-foreground">
                                    Coming Soon
                                </Badge>
                            )}
                        </div>
                        <Text className="text-muted-foreground leading-relaxed text-sm">
                            {feature.desc}
                        </Text>
                    </div>
                ))}
            </div>
        </section>
    )
}
