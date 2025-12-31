"use client"

import { useI18n } from "@/components/i18n/I18nProvider"
import { Heading, Text } from "@/components/ui/typography"
import { Button } from "@/components/ui/button"
import { CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"

export function PricingSection() {
    const { t } = useI18n()
    const router = useRouter()
    const supabase = createClient()

    const handlePlanClick = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            router.push("/login?next=/settings/pricing")
        } else {
            router.push("/settings/pricing")
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
        <section className="py-24 px-6 relative">
            <div className="text-center mb-20">
                <Heading as="h2" className="text-3xl md:text-5xl font-bold mb-4 font-heading">
                    {t("landing.simplePricing")}
                </Heading>
                <Text className="text-gray-400 text-lg">
                    {t("landing.simplePricingSubtitle")}
                </Text>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                {plans.map((plan, index) => (
                    <div
                        key={index}
                        className={`
                relative p-10 rounded-3xl flex flex-col
                ${plan.highlight
                                ? 'bg-[#0F1C18] border-2 border-primary shadow-[0_0_50px_rgba(52,211,153,0.15)] transform md:scale-105 z-10'
                                : 'bg-[#141414] border border-white/10 hover:border-white/20 transition-colors'
                            }
              `}
                    >
                        {plan.highlight && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-black text-xs font-bold px-4 py-1.5 rounded-full tracking-wide">
                                MOST POPULAR
                            </div>
                        )}

                        <Heading as="h3" className={`text-2xl font-bold mb-3 ${plan.highlight ? 'text-primary' : 'text-white'}`}>
                            {plan.title}
                        </Heading>

                        <div className="text-4xl font-bold mb-6 text-white font-heading">
                            {plan.price}
                            {plan.key === 'pro' && <span className="text-sm font-normal text-gray-500 ml-1">{t("pricing.pro.unit")}</span>}
                        </div>

                        <Text className="text-gray-500 mb-8 leading-relaxed">
                            {plan.desc}
                        </Text>

                        <ul className="space-y-5 mb-10 flex-1">
                            {plan.features.map((feature, i) => (
                                <li key={i} className="flex items-center gap-4 text-base text-gray-300">
                                    <CheckCircle2 className={`w-5 h-5 ${plan.highlight ? 'text-primary' : 'text-primary/70'}`} />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>

                        <Button
                            variant={plan.highlight ? "default" : "outline"}
                            onClick={handlePlanClick}
                            className={`
                  w-full py-6 text-lg rounded-2xl font-bold transition-all
                  ${plan.highlight
                                    ? 'bg-primary hover:bg-primary/90 text-black shadow-xl shadow-primary/20'
                                    : 'border-white/10 hover:bg-white/5 text-white hover:text-white'
                                }
                `}
                        >
                            {plan.cta}
                        </Button>
                    </div>
                ))}
            </div>
        </section>
    )
}
