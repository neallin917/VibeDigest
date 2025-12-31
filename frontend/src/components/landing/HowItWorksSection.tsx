"use client"

import { useI18n } from "@/components/i18n/I18nProvider"
import { Heading, Text } from "@/components/ui/typography"
import { Link2, Bot, FileText } from "lucide-react"

export function HowItWorksSection() {
    const { t } = useI18n()

    const steps = [
        {
            icon: Link2,
            title: t("landing.step1Title"),
            desc: t("landing.step1Desc"),
            step: 1
        },
        {
            icon: Bot,
            title: t("landing.step2Title"),
            desc: t("landing.step2Desc"),
            step: 2
        },
        {
            icon: FileText,
            title: t("landing.step3Title"),
            desc: t("landing.step3Desc"),
            step: 3
        }
    ]

    return (
        <section className="py-24 px-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-900/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="text-center mb-20 relative z-10">
                <Heading as="h2" className="text-3xl md:text-5xl font-bold mb-4 font-heading">
                    {t("landing.howItWorks")}
                </Heading>
                <Text className="text-gray-400 text-lg">
                    {t("landing.howItWorksSubtitle")}
                </Text>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10">
                {steps.map((step, index) => (
                    <div key={index} className="flex flex-col items-center text-center group">
                        <div className="w-20 h-20 rounded-2xl bg-[#141414] border border-white/10 flex items-center justify-center mb-8 relative group-hover:border-primary/50 transition-colors duration-300 shadow-xl shadow-black/20">
                            <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-primary text-black font-bold flex items-center justify-center text-sm shadow-lg shadow-primary/20">
                                {step.step}
                            </div>
                            <step.icon className="w-8 h-8 text-primary group-hover:scale-110 transition-transform duration-300" />
                        </div>
                        <Heading as="h3" className="text-xl font-bold mb-4 text-white">
                            {step.title}
                        </Heading>
                        <Text className="text-gray-400 leading-relaxed max-w-xs">
                            {step.desc}
                        </Text>
                    </div>
                ))}
            </div>
        </section>
    )
}
