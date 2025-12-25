"use client"

import { LanguageSelect } from "@/components/i18n/LanguageSelect"
import { useI18n } from "@/components/i18n/I18nProvider"
import { PageContainer } from "@/components/layout/PageContainer"
import { Heading, Text } from "@/components/ui/typography"

export default function SettingsPage() {
    const { t } = useI18n()

    return (
        <PageContainer>
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="space-y-2">
                    <Heading as="h2" variant="h1">
                        {t("settings.title")}
                    </Heading>
                    <Text tone="muted">
                        {t("settings.subtitle")}
                    </Text>
                </div>

                <div className="p-6 rounded-xl border border-white/10 bg-black/20 space-y-4">
                    <LanguageSelect />
                </div>
            </div>
        </PageContainer>
    )
}
