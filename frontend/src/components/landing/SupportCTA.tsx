"use client"

import { useI18n } from "@/components/i18n/I18nProvider"
import { Heading, Text } from "@/components/ui/typography"
import { Button } from "@/components/ui/button"
import { Mail, HelpCircle } from "lucide-react"
import { FeedbackDialog } from "@/components/layout/FeedbackDialog"

export function SupportCTA() {
    const { t } = useI18n()

    return (
        <section className="max-w-7xl mx-auto px-6 mb-24">
            <div className="bg-[#141414] border border-white/10 rounded-3xl p-16 md:p-20 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                <div className="relative z-10 max-w-3xl mx-auto">
                    <Heading as="h2" className="text-4xl font-bold mb-6 font-heading text-white">
                        {t("landing.stillHaveQuestions")}
                    </Heading>

                    <Text className="text-gray-400 mb-10 text-xl leading-loose">
                        {t("landing.stillHaveQuestionsDesc")}
                    </Text>

                    <div className="flex flex-col sm:flex-row justify-center gap-5">
                        <FeedbackDialog defaultCategory="support">
                            <Button
                                variant="default"
                                className="bg-primary hover:bg-primary/90 text-black font-bold text-lg py-6 px-10 rounded-full shadow-xl shadow-primary/20 h-auto gap-3"
                            >
                                <Mail className="w-5 h-5" />
                                {t("landing.contactSupport")}
                            </Button>
                        </FeedbackDialog>

                        <Button
                            variant="outline"
                            className="bg-transparent border-gray-600 text-white font-semibold text-lg py-6 px-10 rounded-full hover:bg-white/5 h-auto gap-3"
                        >
                            <HelpCircle className="w-5 h-5" />
                            {t("landing.helpCenter")}
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    )
}
