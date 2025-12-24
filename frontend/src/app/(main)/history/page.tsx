"use client"

import { TaskList } from "@/components/dashboard/TaskList"
import { useI18n } from "@/components/i18n/I18nProvider"
import { Heading } from "@/components/ui/typography"

export default function HistoryPage() {
    const { t } = useI18n()

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Heading as="h2" variant="h1">
                {t("history.title")}
            </Heading>
            <TaskList showHeader={false} />
        </div>
    )
}
