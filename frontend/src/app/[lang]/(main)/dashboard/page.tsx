/**
 * @deprecated This page is deprecated and will be removed in future versions.
 * Users are now redirected to /chat via middleware.
 * See: middleware.ts for redirect logic.
 * 
 * Migration: v3.4 (Chat-First Architecture)
 */
"use client"

import { TaskForm } from "@/components/dashboard/TaskForm"
import { CommunityTemplates } from "@/components/dashboard/CommunityTemplates"
import { PageContainer } from "@/components/layout/PageContainer"

export default function DashboardPage() {
    return (
        <PageContainer>
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex flex-col items-center justify-center py-6 sm:py-10">
                    <div className="w-full max-w-3xl">
                        <TaskForm />
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                    <CommunityTemplates />
                </div>
            </div>
        </PageContainer>
    )
}

