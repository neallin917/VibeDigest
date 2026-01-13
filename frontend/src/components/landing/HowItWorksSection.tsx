"use client"

import { useI18n } from "@/components/i18n/I18nProvider"
import { Heading, Text } from "@/components/ui/typography"
import { Link2, Bot, FileText } from "lucide-react"
import { motion } from "framer-motion"

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
        <section id="how-it-works" className="py-24 px-6 relative overflow-hidden scroll-mt-24">
            {/* Background elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-900/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-7xl mx-auto relative z-10">
                <div className="text-center mb-20">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <Heading as="h2" className="text-3xl md:text-5xl font-display font-bold mb-6">
                            {t("landing.howItWorks")}
                        </Heading>
                        <Text className="text-zinc-400 text-lg max-w-2xl mx-auto">
                            {t("landing.howItWorksSubtitle")}
                        </Text>
                    </motion.div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
                    {/* Connecting Line (Desktop) */}
                    <div className="hidden md:block absolute top-[2.5rem] left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent z-0" />

                    {steps.map((step, index) => (
                        <motion.div
                            key={index}
                            className="flex flex-col items-center text-center group relative z-10"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.2 }}
                        >
                            <div className="w-20 h-20 rounded-2xl bg-zinc-900/80 backdrop-blur-xl border border-white/10 flex items-center justify-center mb-8 relative group-hover:border-emerald-500/50 group-hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)] transition-all duration-500">
                                <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-emerald-500 text-black font-bold flex items-center justify-center text-sm shadow-lg shadow-emerald-500/20">
                                    {step.step}
                                </div>
                                <step.icon className="w-8 h-8 text-emerald-400 group-hover:scale-110 transition-transform duration-500" />
                            </div>

                            <Heading as="h3" className="text-xl font-bold mb-3 text-zinc-100 px-4">
                                {step.title}
                            </Heading>

                            <Text className="text-zinc-400 leading-relaxed max-w-xs text-base">
                                {step.desc}
                            </Text>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
