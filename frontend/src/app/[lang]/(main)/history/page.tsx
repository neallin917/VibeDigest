/**
 * @deprecated This page is deprecated and will be removed in future versions.
 * Users are now redirected to /chat?library=open via middleware.
 * See: middleware.ts for redirect logic.
 * 
 * Migration: v3.4 (Chat-First Architecture)
 */
"use client"

import { TaskList } from "@/components/dashboard/TaskList"
import { useI18n } from "@/components/i18n/I18nProvider"
import { PageContainer } from "@/components/layout/PageContainer"
import { Heading } from "@/components/ui/typography"

export default function HistoryPage() {
    const { t } = useI18n()

    return (
        <PageContainer>
            <div className="max-w-4xl mx-auto space-y-6">
                <Heading as="h2" variant="h1">
                    {t("history.title")}
                </Heading>
                <TaskList showHeader={false} excludeDemo={true} />
            </div>
        </PageContainer>
    )
}
