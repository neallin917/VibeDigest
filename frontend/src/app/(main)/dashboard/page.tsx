"use client"

import { TaskForm } from "@/components/dashboard/TaskForm"
import { TaskList } from "@/components/dashboard/TaskList"

export default function DashboardPage() {
    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                <p className="text-muted-foreground">
                    Manage your video transcriptions and summaries.
                </p>
            </div>

            <TaskForm />

            <div className="pt-4">
                <TaskList />
            </div>
        </div>
    )
}
