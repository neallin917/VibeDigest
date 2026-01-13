"use client"

import { TaskForm } from "@/components/dashboard/TaskForm"
import { CommunityTemplates } from "@/components/dashboard/CommunityTemplates"
import { PageContainer } from "@/components/layout/PageContainer"

export default function DashboardPage() {
    return (
        <PageContainer>
            <div className="max-w-7xl mx-auto space-y-12 md:space-y-16 px-4 sm:px-6">
                <div className="flex flex-col items-center justify-center pt-8 sm:pt-16 pb-4">
                    <div className="w-full max-w-4xl">
                        <TaskForm />
                    </div>
                </div>

                <div className="pt-8">
                    <CommunityTemplates />
                </div>
            </div>
        </PageContainer>
    )
}

