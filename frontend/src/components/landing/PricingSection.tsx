"use client"

import { useI18n } from "@/components/i18n/I18nProvider"
import { Heading, Text } from "@/components/ui/typography"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Zap } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { motion } from "framer-motion"

export function PricingSection() {
    const { t, locale } = useI18n()
    const router = useRouter()
    const supabase = createClient()

    const handlePlanClick = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            router.push(`/${locale}/login?next=/${locale}/settings/pricing`)
        } else {
            router.push(`/${locale}/settings/pricing`)
        }
    }

    const freeFeatureKeys = [
        "pricing.free.features.f1",
        "pricing.free.features.f4",
        "pricing.free.features.f5",
    ] as const

    const proFeatureKeys = [
        "pricing.pro.features.f1",
        "pricing.pro.features.f2",
        "pricing.pro.features.f3", // Added f3 directly here if available, or just map what we have
    ] as const

    const topupFeatureKeys = [
        "pricing.topup.features.f1",
        "pricing.topup.features.f2",
        "pricing.topup.features.f3",
    ] as const

    const plans = [
        {
            key: "free",
            title: t("pricing.free.title"),
            price: t("pricing.free.price"),
            desc: t("pricing.free.desc"),
            features: freeFeatureKeys.map(k => t(k)),
            cta: t("landing.getStarted"),
            highlight: false
        },
        {
            key: "pro",
            title: t("pricing.pro.title"),
            price: t("pricing.pro.price"),
            desc: t("pricing.pro.desc"),
            features: proFeatureKeys.map(k => t(k)),
            cta: t("pricing.pro.button"),
            highlight: true
        },
        {
            key: "topup",
            title: t("pricing.topup.title"),
            price: t("pricing.topup.price"),
            desc: t("pricing.topup.desc"),
            features: topupFeatureKeys.map(k => t(k)),
            cta: t("pricing.topup.button"),
            highlight: false
        }
    ]

    return (
        <section id="pricing" className="py-24 px-6 relative scroll-mt-24">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <Heading as="h2" className="text-3xl md:text-5xl font-bold mb-6 font-display">
                            {t("landing.simplePricing")}
                        </Heading>
                        <Text className="text-zinc-400 text-lg">
                            {t("landing.simplePricingSubtitle")}
                        </Text>
                    </motion.div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {plans.map((plan, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className={`
                                relative p-8 rounded-3xl flex flex-col
                                ${plan.highlight
                                    ? 'bg-zinc-900/80 border border-emerald-500/30 shadow-[0_0_40px_-10px_rgba(16,185,129,0.2)] md:-mt-4 md:mb-4 z-10'
                                    : 'bg-zinc-900/40 border border-white/5 hover:border-white/10 transition-colors'
                                }
                            `}
                        >
                            {plan.highlight && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-black text-[11px] font-bold px-4 py-1.5 rounded-full tracking-wider uppercase shadow-lg flex items-center gap-1.5">
                                    <Zap className="w-3 h-3 fill-black" />
                                    MOST POPULAR
                                </div>
                            )}

                            <Heading as="h3" className={`text-xl font-bold mb-2 ${plan.highlight ? 'text-emerald-400' : 'text-zinc-100'}`}>
                                {plan.title}
                            </Heading>

                            <div className="flex items-baseline gap-1 mb-6">
                                <span className="text-4xl font-bold text-white font-display tracking-tight">{plan.price}</span>
                                {plan.key === 'pro' && <span className="text-sm text-zinc-500">{t("pricing.pro.unit")}</span>}
                            </div>

                            <Text className="text-zinc-400 mb-8 leading-relaxed text-sm min-h-[40px]">
                                {plan.desc}
                            </Text>

                            <ul className="space-y-4 mb-8 flex-1">
                                {plan.features.map((feature, i) => (
                                    <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                                        <CheckCircle2 className={`w-5 h-5 shrink-0 ${plan.highlight ? 'text-emerald-500' : 'text-zinc-600'}`} />
                                        <span className="leading-snug">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <Button
                                variant={plan.highlight ? "default" : "outline"}
                                onClick={handlePlanClick}
                                className={`
                                    w-full h-12 rounded-xl font-semibold transition-all duration-300
                                    ${plan.highlight
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black shadow-lg shadow-emerald-500/20 border-0'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10 text-white hover:text-white hover:border-white/20'
                                    }
                                `}
                            >
                                {plan.cta}
                            </Button>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
