"use client"

import { LanguageSelect } from "@/components/i18n/LanguageSelect"
import { useI18n } from "@/components/i18n/I18nProvider"

export default function SettingsPage() {
    const { t } = useI18n()

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">{t("settings.title")}</h2>
                <p className="text-muted-foreground">
                    {t("settings.subtitle")}
                </p>
            </div>

            <div className="p-6 rounded-xl border border-white/10 bg-black/20 space-y-4">
                <LanguageSelect />
            </div>
        </div>
    )
}
