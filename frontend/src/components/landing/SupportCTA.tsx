"use client"

import { useI18n } from "@/components/i18n/I18nProvider"
import { Heading, Text } from "@/components/ui/typography"
import { Button } from "@/components/ui/button"
import { Mail, HelpCircle } from "lucide-react"
import { FeedbackDialog } from "@/components/layout/FeedbackDialog"

export function SupportCTA() {
    const { t } = useI18n()

    return (
        <section className="max-w-6xl mx-auto px-4 mb-16">
            <div className="bg-card border border-white/10 rounded-2xl p-10 md:p-12 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                <div className="relative z-10 max-w-2xl mx-auto">
                    <Heading as="h2" className="text-3xl font-bold mb-4 font-heading text-white">
                        {t("landing.stillHaveQuestions")}
                    </Heading>

                    <Text className="text-muted-foreground mb-8 text-base leading-relaxed">
                        {t("landing.stillHaveQuestionsDesc")}
                    </Text>

                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <FeedbackDialog defaultCategory="support">
                            <Button
                                variant="default"
                                className="bg-primary hover:bg-primary/90 text-black font-bold text-base h-11 px-8 rounded-full shadow-xl shadow-primary/20 gap-2"
                            >
                                <Mail className="w-4 h-4" />
                                {t("landing.contactSupport")}
                            </Button>
                        </FeedbackDialog>

                        <Button
                            variant="outline"
                            className="bg-transparent border-white/20 text-white font-semibold text-base h-11 px-8 rounded-full hover:bg-white/5 gap-2"
                        >
                            <HelpCircle className="w-4 h-4" />
                            {t("landing.helpCenter")}
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    )
}
