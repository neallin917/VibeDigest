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
        <section id="pricing" className="py-16 px-4 relative scroll-mt-24"> {/* Reduced py-24 -> py-16, px-6 -> px-4 */}
            <div className="text-center mb-12"> {/* Reduced mb-20 -> mb-12 */}
                <Heading as="h2" className="text-2xl md:text-3xl font-bold mb-3 font-heading"> {/* Reduced text-3xl/5xl -> 2xl/3xl */}
                    {t("landing.simplePricing")}
                </Heading>
                <Text className="text-muted-foreground text-base"> {/* Reduced text-lg -> text-base */}
                    {t("landing.simplePricingSubtitle")}
                </Text>
            </div>

            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6"> {/* Reduced max-w-7xl, gap-8 -> gap-6 */}
                {plans.map((plan, index) => (
                    <div
                        key={index}
                        className={`
                relative p-6 rounded-2xl flex flex-col {/* Reduced p-10 -> p-6, rounded-3xl -> 2xl */}
                ${plan.highlight
                                ? 'bg-[#0F1C18] border-2 border-primary shadow-[0_0_40px_rgba(52,211,153,0.1)] transform md:scale-105 z-10'
                                : 'bg-card border border-white/10 hover:border-white/20 transition-colors' // Use theme vars
                            }
              `}
                    >
                        {plan.highlight && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-black text-[10px] font-bold px-3 py-1 rounded-full tracking-wide uppercase"> {/* Smaller badge */}
                                MOST POPULAR
                            </div>
                        )}

                        <Heading as="h3" className={`text-lg font-bold mb-2 ${plan.highlight ? 'text-primary' : 'text-foreground'}`}> {/* Reduced text-2xl -> text-lg */}
                            {plan.title}
                        </Heading>

                        <div className="text-3xl font-bold mb-4 text-foreground font-heading"> {/* Reduced text-4xl -> text-3xl */}
                            {plan.price}
                            {plan.key === 'pro' && <span className="text-xs font-normal text-muted-foreground ml-1">{t("pricing.pro.unit")}</span>}
                        </div>

                        <Text className="text-muted-foreground mb-6 leading-relaxed text-sm"> {/* Reduced text-gray-500 -> muted-foreground, added text-sm */}
                            {plan.desc}
                        </Text>

                        <ul className="space-y-3 mb-8 flex-1"> {/* Reduced space-y-5 -> 3, mb-10 -> 8 */}
                            {plan.features.map((feature, i) => (
                                <li key={i} className="flex items-center gap-3 text-sm text-foreground/80"> {/* Reduced text-base -> text-sm, gap-4 -> 3 */}
                                    <CheckCircle2 className={`w-4 h-4 ${plan.highlight ? 'text-primary' : 'text-primary/70'}`} /> {/* Reduced w-5 h-5 -> w-4 h-4 */}
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>

                        <Button
                            variant={plan.highlight ? "default" : "outline"}
                            onClick={handlePlanClick}
                            className={`
                  w-full h-10 text-sm rounded-xl font-semibold transition-all {/* Replaced py-6 text-lg -> h-10 text-sm */}
                  ${plan.highlight
                                    ? 'bg-primary hover:bg-primary/90 text-black shadow-lg shadow-primary/10'
                                    : 'border-white/10 hover:bg-white/5 text-foreground hover:text-foreground'
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
