"use client"

import { TaskList } from "@/components/dashboard/TaskList"
import { useI18n } from "@/components/i18n/I18nProvider"

export default function HistoryPage() {
    const { t } = useI18n()

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">{t("history.title")}</h2>
                <p className="text-muted-foreground">
                    {t("history.subtitle")}
                </p>
            </div>

            <TaskList />
        </div>
    )
}
