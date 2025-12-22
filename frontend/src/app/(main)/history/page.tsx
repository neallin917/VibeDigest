import { TaskList } from "@/components/dashboard/TaskList"

export default function HistoryPage() {
    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Transcription History</h2>
                <p className="text-muted-foreground">
                    View and manage all your past video tasks.
                </p>
            </div>

            <TaskList />
        </div>
    )
}
