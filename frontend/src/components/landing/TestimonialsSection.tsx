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
        <section className="py-24 px-6 mb-32">
            <div className="text-center mb-20">
                <Heading as="h2" className="text-3xl md:text-5xl font-bold mb-6 font-heading">
                    {t("landing.lovedByResearchers")}
                </Heading>
                <Text className="text-gray-400 text-xl font-light">
                    {t("landing.lovedByResearchersSubtitle")}
                </Text>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                {testimonials.map((item, index) => (
                    <div key={index} className="bg-[#141414] border border-white/10 rounded-3xl p-10 relative">
                        <Quote className="text-primary/10 w-24 h-24 absolute top-6 right-6 rotate-180" />

                        <div className="flex items-center gap-5 mb-8 relative z-10">
                            <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center text-white font-bold text-xl`}>
                                {item.initial}
                            </div>
                            <div>
                                <div className="font-bold text-lg text-white font-heading">{item.author}</div>
                                <div className="text-sm text-primary font-semibold">{item.role}</div>
                            </div>
                        </div>

                        <p className="text-gray-300 text-lg leading-loose relative z-10">
                            {item.quote}
                        </p>
                    </div>
                ))}
            </div>
        </section>
    )
}
