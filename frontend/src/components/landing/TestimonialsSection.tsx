"use client"

import { useI18n } from "@/components/i18n/I18nProvider"
import { Heading, Text } from "@/components/ui/typography"
import { Quote } from "lucide-react"
import { motion } from "framer-motion"

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
        <section className="py-24 px-6 relative mb-12">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <Heading as="h2" className="text-3xl md:text-4xl font-bold mb-6 font-display">
                            {t("landing.lovedByResearchers")}
                        </Heading>
                        <Text className="text-zinc-400 text-lg font-light">
                            {t("landing.lovedByResearchersSubtitle")}
                        </Text>
                    </motion.div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {testimonials.map((item, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-3xl p-8 relative group hover:bg-zinc-900/60 transition-colors"
                        >
                            <Quote className="text-white/5 w-20 h-20 absolute top-4 right-4 rotate-180 group-hover:text-white/10 transition-colors" />

                            <div className="flex items-center gap-4 mb-8 relative z-10">
                                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                                    {item.initial}
                                </div>
                                <div>
                                    <div className="font-bold text-lg text-white font-display">{item.author}</div>
                                    <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{item.role}</div>
                                </div>
                            </div>

                            <p className="text-zinc-300 text-base leading-relaxed relative z-10 font-medium italic">
                                "{item.quote}"
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
