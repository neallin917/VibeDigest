"use client"

import { useI18n } from "@/components/i18n/I18nProvider"
import { Heading, Text } from "@/components/ui/typography"
import { Quote } from "lucide-react"

export function TestimonialsSection() {
    const { t } = useI18n()

    const testimonials = [
        {
            quote: t("landing.testimonial1"),
            author: t("landing.testimonial1Author"),
            role: t("landing.testimonial1Role"),
            initial: "S",
            color: "from-purple-500 to-indigo-500"
        },
        {
            quote: t("landing.testimonial2"),
            author: t("landing.testimonial2Author"),
            role: t("landing.testimonial2Role"),
            initial: "M",
            color: "from-orange-400 to-red-500"
        },
        {
            quote: t("landing.testimonial3"),
            author: t("landing.testimonial3Author"),
            role: t("landing.testimonial3Role"),
            initial: "A",
            color: "from-blue-400 to-cyan-500"
        }
    ]

    return (

        <section className="py-16 px-4 mb-16">
            <div className="text-center mb-12">
                <Heading as="h2" className="text-2xl md:text-3xl font-bold mb-4 font-heading">
                    {t("landing.lovedByResearchers")}
                </Heading>
                <Text className="text-muted-foreground text-base font-light">
                    {t("landing.lovedByResearchersSubtitle")}
                </Text>
            </div>

            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
                {testimonials.map((item, index) => (
                    <div key={index} className="bg-card border border-white/10 rounded-2xl p-6 relative">
                        <Quote className="text-primary/10 w-16 h-16 absolute top-4 right-4 rotate-180" />

                        <div className="flex items-center gap-4 mb-6 relative z-10">
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center text-white font-bold text-sm`}>
                                {item.initial}
                            </div>
                            <div>
                                <div className="font-bold text-base text-white font-heading">{item.author}</div>
                                <div className="text-xs text-primary font-semibold">{item.role}</div>
                            </div>
                        </div>

                        <p className="text-muted-foreground text-sm leading-relaxed relative z-10">
                            {item.quote}
                        </p>
                    </div>
                ))}
            </div>
        </section>
    )
}
