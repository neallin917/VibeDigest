"use client"

import { TaskForm } from "@/components/dashboard/TaskForm"
import { TaskList } from "@/components/dashboard/TaskList"
import { PageContainer } from "@/components/layout/PageContainer"

export default function DashboardPage() {
    return (
        <PageContainer>
            <div className="max-w-6xl mx-auto space-y-8">
                <TaskForm />

                <div className="pt-4 border-t border-white/10">
                    <TaskList />
                </div>
            </div>
        </PageContainer>
    )
}
