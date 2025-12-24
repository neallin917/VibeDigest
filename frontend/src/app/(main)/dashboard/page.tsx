"use client"

import { TaskForm } from "@/components/dashboard/TaskForm"
import { TaskList } from "@/components/dashboard/TaskList"
import { useI18n } from "@/components/i18n/I18nProvider"
import { UsageCard } from "@/components/dashboard/UsageCard"

export default function DashboardPage() {
    const { t } = useI18n()

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">{t("dashboard.title")}</h2>
                <p className="text-muted-foreground">
                    {t("dashboard.subtitle")}
                </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <TaskForm />
                </div>
                <div className="lg:col-span-1">
                    <UsageCard />
                </div>
            </div>

            <div className="pt-4 border-t border-white/10">
                <TaskList />
            </div>
        </div>
    )
}
