"use client"

import { useI18n } from "@/components/i18n/I18nProvider"
import { Heading, Text } from "@/components/ui/typography"
import { Button } from "@/components/ui/button"
import { Mail } from "lucide-react"
import { FeedbackDialog } from "@/components/layout/FeedbackDialog"
import { motion } from "framer-motion"

export function SupportCTA() {
    const { t } = useI18n()

    return (
        <section className="max-w-5xl mx-auto px-6 mb-24">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="bg-zinc-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-12 md:p-20 text-center relative overflow-hidden group"
            >
                {/* Animated Glows */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/20 transition-colors duration-700" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 group-hover:bg-indigo-500/20 transition-colors duration-700" />

                <div className="relative z-10 max-w-2xl mx-auto">
                    <Heading as="h2" className="text-3xl md:text-4xl font-bold mb-6 font-display text-white">
                        {t("landing.stillHaveQuestions")}
                    </Heading>

                    <Text className="text-zinc-400 mb-10 text-lg leading-relaxed">
                        {t("landing.stillHaveQuestionsDesc")}
                    </Text>

                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <FeedbackDialog defaultCategory="support">
                            <Button
                                variant="default"
                                className="bg-white text-black hover:bg-zinc-200 font-bold text-base h-12 px-8 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] hover:-translate-y-1 gap-2 border-0"
                            >
                                <Mail className="w-4 h-4" />
                                {t("landing.contactSupport")}
                            </Button>
                        </FeedbackDialog>
                    </div>
                </div>
            </motion.div>
        </section>
    )
}
