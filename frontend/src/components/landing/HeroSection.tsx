"use client"

import { useI18n } from "@/components/i18n/I18nProvider"
import { TaskForm } from "@/components/dashboard/TaskForm"
import { Heading, Text } from "@/components/ui/typography"

export function HeroSection() {
    const { t } = useI18n()

    const renderWithBold = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g)
        return parts.map((part, index) => {
            if (part.startsWith("**") && part.endsWith("**")) {
                return <strong key={index} className="text-white font-semibold">{part.slice(2, -2)}</strong>
            }
            return part
        })
    }

    return (
        <section className="flex flex-col items-center justify-center px-6 pt-32 pb-14 md:pt-40 md:pb-20 text-center space-y-10 relative z-10">
            <div className="space-y-6 max-w-4xl">
                <Heading
                    as="h1"
                    className="text-4xl md:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white via-white/95 to-white/60 leading-[1.1] mb-6"
                >
                    {t("landing.titlePrefix")}{" "}
                    <span className="block mt-2 text-primary drop-shadow-[0_0_30px_rgba(62,207,142,0.3)]">
                        {t("landing.titleEmphasis")}
                    </span>
                </Heading>

                <Text tone="muted" className="max-w-2xl mx-auto text-base md:text-lg leading-relaxed text-muted-foreground">
                    {renderWithBold(t("landing.smartSummarizationDesc"))}
                </Text>
            </div>

            <div className="w-full z-20 mt-12 mb-8 px-4">
                <TaskForm simple={true} />
            </div>
        </section>
    )
}
